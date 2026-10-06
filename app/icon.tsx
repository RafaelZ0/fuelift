import { desenharIcone } from "@/lib/icone";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icone() {
  return desenharIcone(32, 0.12);
}
