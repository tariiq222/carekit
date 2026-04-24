/**
 * Optional background image asset.
 *
 * To use a custom background image:
 *   1. Save your image to `assets/bg.webp` (recommend 430×932 WebP, quality 75, ~50-80KB)
 *   2. Uncomment the require() line below and delete the `null` export
 *
 * If BG_SOURCE is null, the Background component falls back to
 * the SVG silk curves + LinearGradient (zero-bytes default).
 */

import type { ImageSourcePropType } from "react-native";

export const BG_SOURCE: ImageSourcePropType = require("../assets/bg.jpg");
