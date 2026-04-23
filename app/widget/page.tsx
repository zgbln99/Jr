import type { Metadata } from "next";
import { getLatestCounter } from "@/lib/db";
import { WidgetCounter } from "@/components/WidgetCounter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Widget OBS",
  robots: { index: false, follow: false },
};

type SearchParams = {
  bg?: string;
  text?: string;
  scale?: string;
  label?: string;
};

export default function WidgetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const row = getLatestCounter();
  const counter = {
    amount: row?.amount_pln ?? 0,
    source: (row?.source ?? "manual") as "ocr" | "manual",
    updatedAt: row?.created_at ?? null,
  };

  const bg: "transparent" | "dark" | "chroma" =
    searchParams.bg === "dark"
      ? "dark"
      : searchParams.bg === "chroma"
        ? "chroma"
        : "transparent";
  const text: "white" | "charcoal" | "red" =
    searchParams.text === "charcoal"
      ? "charcoal"
      : searchParams.text === "red"
        ? "red"
        : "white";
  const scale = Math.max(
    0.4,
    Math.min(2.5, Number(searchParams.scale) || 1),
  );
  const label = searchParams.label === "0" ? false : true;

  return (
    <WidgetCounter
      initial={counter}
      bg={bg}
      text={text}
      scale={scale}
      label={label}
    />
  );
}
