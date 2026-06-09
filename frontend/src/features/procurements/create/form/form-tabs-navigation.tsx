import type { ReactElement } from "react";

import {
  CalendarRange,
  CircleAlert,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/shared/ui/kit/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/kit/tabs";

import { BaseInfoSection } from "./base-info-section";
import { ContractSection } from "./contract-section";
import { PlanningSection } from "./planning-section";

const TABS_CONFIG: {
  value: string;
  title: string;
  icon: LucideIcon;
  Component: () => ReactElement;
}[] = [
  {
    value: "main-info",
    title: "Основная информация",
    icon: CircleAlert,
    Component: BaseInfoSection,
  },
  {
    value: "contract-info",
    title: "Договорная информация",
    icon: FileText,
    Component: ContractSection,
  },
  {
    value: "planning-info",
    title: "Планирование",
    icon: CalendarRange,
    Component: PlanningSection,
  },
];

export const FormTabsNavigation = () => {
  return (
    <Card className="gap-0 p-0">
      <Tabs defaultValue="main-info">
        <TabsList
          variant="line"
          className="bg-accent w-full border-b group-data-horizontal/tabs:h-12">
          {TABS_CONFIG.map(({ icon: Icon, ...tab }) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-active:text-chart-4 after:bg-chart-4 hover:text-chart-4 text-[16px] transition-all">
              <Icon className="size-4.5" />
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>
        <CardContent className="px-6 py-0">
          {TABS_CONFIG.map(({ Component, ...tab }) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              {Component && <Component />}
            </TabsContent>
          ))}
        </CardContent>
      </Tabs>
    </Card>
  );
};
