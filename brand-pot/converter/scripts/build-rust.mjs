import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),privateRoot=fileURLToPath(new URL('../../qa/private/converter-toolchain/',import.meta.url));
const env={...process.env};let cargo='cargo';
if(!env.CARGO_HOME&&existsSync(privateRoot+'cargo/bin/cargo')){env.CARGO_HOME=privateRoot+'cargo';env.RUSTUP_HOME=privateRoot+'rustup';cargo=env.CARGO_HOME+'/bin/cargo';}
const result=spawnSync(cargo,['build','--manifest-path',root+'rust/Cargo.toml','--locked','--target','wasm32-unknown-unknown','--release'],{env,stdio:'inherit'});
if(result.error){console.error('Install Rust with the wasm32-unknown-unknown target, or set CARGO_HOME/RUSTUP_HOME to a task-local toolchain.');process.exit(1);}process.exit(result.status??1);
