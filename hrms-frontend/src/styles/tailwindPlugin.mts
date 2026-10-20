import plugin from "tailwindcss/plugin";

import { baseStyles } from "./baseStyles";
import { designTokens } from "./tokens";
import { controlVariants } from "./variants";

/** App-wide CSS: design tokens and document defaults in `@layer base`, plus named control variants. */
export default plugin(({ addBase, addVariant }) => {
  for (const { selector, vars } of designTokens) addBase({ [selector]: vars });
  for (const rule of baseStyles) addBase(rule);
  for (const [name, selector] of controlVariants) {
    addVariant(name, typeof selector === "string" ? selector : { [selector.join(", ")]: "@slot" });
  }
});
