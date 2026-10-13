import type { ComponentType } from "react";
import type { LayoutProps } from "../Layout";
import type { ScreenId } from "../nav";

export type ScreenComponent = ComponentType<{ param?: string }>;

export type Variant = {
  key: string;
  name: string;
  tagline: string;
  Layout?: ComponentType<LayoutProps>;
  screens: Partial<Record<ScreenId, ScreenComponent>>;
};
