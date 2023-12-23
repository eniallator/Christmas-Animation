import { colorConfig, config, configCollection } from "../configParser/create";

export default config(
  configCollection({
    id: "palette",
    label: "Decoration Colour Palette",
    expandable: true,
    fields: [
      colorConfig({
        id: "palette-colour",
        label: "Colour",
      }),
    ],
    default: [["ff0000"], ["ff7878"], ["ffffff"], ["74d680"], ["378b29"]],
  })
);
