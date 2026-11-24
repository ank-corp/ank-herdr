import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { theme } from "herdr";
import { CONTRACT } from "./lib/version.js";

export default class Ank extends View {
  init(_props, _cx) {}

  render(_cx) {
    const t = theme();
    return v_flex().size_full().bg(t.surface).p(10).gap(4).text_size(13)
      .child(div().text_color(t.foreground).child("ank"))
      .child(div().text_color(t.dim).child(`contract ${CONTRACT}`));
  }
}
