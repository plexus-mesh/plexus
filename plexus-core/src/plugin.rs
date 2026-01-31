use anyhow::Result;
use wasmtime::*;

pub trait Skill {
    fn name(&self) -> String;
    fn execute(&mut self, input: &str) -> Result<String>;
}

pub struct WasmHost {
    engine: Engine,
    linker: Linker<()>,
}

impl WasmHost {
    pub fn new() -> Result<Self> {
        let engine = Engine::default();
        let linker = Linker::new(&engine);
        Ok(Self { engine, linker })
    }

    pub fn load_plugin(&self, path: &str) -> Result<WasmPlugin> {
        let module = Module::from_file(&self.engine, path)?;
        Ok(WasmPlugin {
            module,
            linker: self.linker.clone(),
            engine: self.engine.clone(),
            name: std::path::Path::new(path)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
        })
    }
}

pub struct WasmPlugin {
    module: Module,
    linker: Linker<()>,
    engine: Engine,
    name: String,
}

impl Skill for WasmPlugin {
    fn name(&self) -> String {
        self.name.clone()
    }

    fn execute(&mut self, _input: &str) -> Result<String> {
        let mut store = Store::new(&self.engine, ());
        let instance = self.linker.instantiate(&mut store, &self.module)?;

        // Basic execution: looking for a 'run' export
        // For a real string-passing implementation, we'd need Wasm memory access
        // or the Component Model (wit-bindgen).
        // For this architecture proof, we verify we can instantiate and run.
        let run = instance
            .get_typed_func::<(), ()>(&mut store, "run")
            .or_else(|_| instance.get_typed_func::<(), ()>(&mut store, "_start"))?;

        run.call(&mut store, ())?;

        Ok(format!(
            "Plugin {} executed successfully (WASM Sandbox).",
            self.name
        ))
    }
}
