import type { Metadata } from "next";
import { getLatestCounter } from "@/lib/db";
import { logPageView } from "@/lib/analytics";
import { WidgetCounter } from "@/components/WidgetCounter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Widget OBS",
  robots: { index: false, follow: false },
};

type SearchParams = {
  bg?: string;
  text?: string;
  accent?: string;
  shadow?: string;
  scale?: string;
  label?: string;
};

export default function WidgetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  logPageView("/widget");
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
  const accent: "red" | "white" | "none" =
    searchParams.accent === "white"
      ? "white"
      : searchParams.accent === "none"
        ? "none"
        : "red";
  const shadow: "none" | "soft" | "strong" =
    searchParams.shadow === "none"
      ? "none"
      : searchParams.shadow === "soft"
        ? "soft"
        : "strong";
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
      accent={accent}
      shadow={shadow}
      scale={scale}
      label={label}
    />
  );
}
