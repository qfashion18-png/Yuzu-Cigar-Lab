import NextLink from "next/link";
import type { ComponentProps } from "react";

type StaticLinkProps = ComponentProps<typeof NextLink>;

export default function Link(props: StaticLinkProps) {
  return <NextLink {...props} prefetch={false} />;
}
