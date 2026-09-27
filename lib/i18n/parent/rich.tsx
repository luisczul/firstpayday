import { Fragment, type ReactNode } from "react";

/** Fill "{name}" placeholders with React nodes: rich(t("key"), { parent: <b>Parent</b> }). */
export function rich(template: string, parts: Record<string, ReactNode>): ReactNode {
  const pieces = template.split(/\{(\w+)\}/);
  return pieces.map((p, i) => (i % 2 === 1 ? <Fragment key={i}>{parts[p] ?? `{${p}}`}</Fragment> : p));
}
