import { desenharIcone } from "@/lib/icone";

export const dynamic = "force-static";

export function GET() {
  return desenharIcone(512, 0.3);
}
