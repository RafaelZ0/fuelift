import { desenharIcone } from "@/lib/icone";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function IconeApple() {
  return desenharIcone(180, 0.18);
}
