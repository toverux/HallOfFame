/**
 * `DropdownItem` types `iconTint` after the C# binding shape, where it is a color, but the `Icon`
 * it reaches takes a boolean too, and only the boolean leaves the color to CSS. An inline color
 * would win over the stylesheet and strand the icon on one shade while the label lights up.
 */
export const iconTintFromStylesheet = true as unknown as string;
