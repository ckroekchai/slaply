use std::cell::RefCell;
use std::str::FromStr;
thread_local! { static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) }; }

fn valid_color(value: &str) -> bool {
    if let Some(hex) = value.strip_prefix('#') {
        // svgtypes deliberately coerces non-hex digits to zero; we must not.
        if ![3, 4, 6, 8].contains(&hex.len()) || !hex.bytes().all(|b| b.is_ascii_hexdigit()) { return false; }
    }
    svgtypes::Color::from_str(value).is_ok()
}

fn valid_length(value: &str, nonnegative: bool) -> bool {
    match svgtypes::Length::from_str(value) {
        Ok(length) => length.number.is_finite() && (!nonnegative || length.number >= 0.0)
            && !matches!(length.unit, svgtypes::LengthUnit::Em | svgtypes::LengthUnit::Ex),
        Err(_) => false,
    }
}

// Validate the exact values that usvg would otherwise warn about and ignore.
// Unsupported properties are already rejected by the XML-side allowlist.
fn valid_property(name: &str, value: &str) -> bool {
    let value = value.trim();
    match name {
        "fill" | "stroke" => matches!(value, "none" | "inherit" | "currentColor")
            || (value.starts_with("url(#") && svgtypes::Paint::from_str(value).is_ok()) || valid_color(value),
        "stop-color" => matches!(value, "inherit" | "currentColor") || valid_color(value),
        "opacity" | "fill-opacity" | "stroke-opacity" | "stop-opacity" => value == "inherit"
            || svgtypes::Number::from_str(value).is_ok_and(|n| n.0.is_finite() && (0.0..=1.0).contains(&n.0)),
        "x" | "y" | "x1" | "y1" | "x2" | "y2" | "cx" | "cy" | "fx" | "fy" | "stroke-dashoffset" => valid_length(value, false),
        "width" | "height" | "r" | "rx" | "ry" | "fr" | "stroke-width" => valid_length(value, true),
        "offset" => svgtypes::Length::from_str(value).is_ok_and(|n| n.number.is_finite()
            && match n.unit { svgtypes::LengthUnit::None => (0.0..=1.0).contains(&n.number), svgtypes::LengthUnit::Percent => (0.0..=100.0).contains(&n.number), _ => false }),
        "stroke-miterlimit" => svgtypes::Number::from_str(value).is_ok_and(|n| n.0.is_finite() && n.0 >= 1.0),
        "stroke-dasharray" => value == "none" || value == "inherit" || (!value.is_empty() && svgtypes::LengthListParser::from(value)
            .all(|n| n.is_ok_and(|v| v.number.is_finite() && v.number >= 0.0 && !matches!(v.unit, svgtypes::LengthUnit::Em | svgtypes::LengthUnit::Ex)))),
        "fill-rule" | "clip-rule" => matches!(value, "nonzero" | "evenodd" | "inherit"),
        "stroke-linecap" => matches!(value, "butt" | "round" | "square" | "inherit"),
        "stroke-linejoin" => matches!(value, "miter" | "round" | "bevel" | "inherit"),
        "gradientUnits" | "clipPathUnits" => matches!(value, "userSpaceOnUse" | "objectBoundingBox"),
        "spreadMethod" => matches!(value, "pad" | "reflect" | "repeat"),
        "clip-path" => value == "none" || value == "inherit" || value.starts_with("url(#"),
        "preserveAspectRatio" => svgtypes::AspectRatio::from_str(value).is_ok(),
        "points" => {
            let points = svgtypes::NumberListParser::from(value).collect::<Result<Vec<_>, _>>();
            points.is_ok_and(|v| !v.is_empty() && v.len() % 2 == 0 && v.iter().all(|n| n.is_finite()))
        }
        _ => true,
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let data = vec![0u8; len].into_boxed_slice();
    Box::into_raw(data) as *mut u8
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    unsafe { drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len))); }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn render(ptr: *const u8, len: usize, width: u32, height: u32) -> u32 {
    if len > 5 * 1024 * 1024 || width == 0 || height == 0 || width > 2048 || height > 2048 || u64::from(width) * u64::from(height) > 4_000_000 { return 1; }
    let data = unsafe { std::slice::from_raw_parts(ptr, len) };
    let text = match std::str::from_utf8(data) { Ok(t) => t, Err(_) => return 2 };
    let document = match roxmltree::Document::parse(text) { Ok(d) => d, Err(_) => return 2 };
    for node in document.descendants().filter(|n| n.is_element()) {
        for attribute in node.attributes() {
            if attribute.name() == "style" {
                for declaration in attribute.value().split(';').filter(|d| !d.trim().is_empty()) {
                    let Some((name, value)) = declaration.split_once(':') else { return 5; };
                    if !valid_property(name.trim(), value) { return 5; }
                }
            } else if !valid_property(attribute.name(), attribute.value()) { return 5; }
        }
        if node.has_tag_name("path") {
            if let Some(path) = node.attribute("d") {
                if svgtypes::PathParser::from(path).any(|segment| segment.is_err()) { return 5; }
            }
        }
        for attr in ["transform", "gradientTransform"] {
            if let Some(value) = node.attribute(attr) {
                if svgtypes::TransformListParser::from(value).any(|transform| transform.is_err()) { return 5; }
            }
        }
    }
    let tree = match resvg::usvg::Tree::from_data(data, &resvg::usvg::Options::default()) { Ok(t) => t, Err(_) => return 2 };
    let mut pixmap = match resvg::tiny_skia::Pixmap::new(width, height) { Some(p) => p, None => return 3 };
    let size = tree.size();
    resvg::render(&tree, resvg::tiny_skia::Transform::from_scale(width as f32 / size.width(), height as f32 / size.height()), &mut pixmap.as_mut());
    let png = match pixmap.encode_png() { Ok(p) => p, Err(_) => return 4 };
    OUTPUT.with(|out| *out.borrow_mut() = png);
    0
}
#[unsafe(no_mangle)]
pub extern "C" fn output_ptr() -> *const u8 { OUTPUT.with(|out| out.borrow().as_ptr()) }
#[unsafe(no_mangle)]
pub extern "C" fn output_len() -> usize { OUTPUT.with(|out| out.borrow().len()) }
