import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(90);
Config.setOverwriteOutput(true);
Config.setEntryPoint("src/index.ts");

// The engine package uses NodeNext-style `./foo.js` imports for `.ts` sources.
Config.overrideWebpackConfig((cfg) => ({
  ...cfg,
  resolve: {
    ...cfg.resolve,
    extensionAlias: { ".js": [".ts", ".tsx", ".js"] },
  },
}));
