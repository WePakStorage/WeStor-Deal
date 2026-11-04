"use client";

import * as React from "react";
import { FileUp, PenLine } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/interactive";

export function NewDealTabs({ initial, manual, om }: { initial: "manual" | "om"; manual: React.ReactNode; om: React.ReactNode }) {
  return (
    <Tabs defaultValue={initial}>
      <TabsList>
        <TabsTrigger value="om"><FileUp /> Upload broker OM</TabsTrigger>
        <TabsTrigger value="manual"><PenLine /> Enter manually</TabsTrigger>
      </TabsList>
      <TabsContent value="om">{om}</TabsContent>
      <TabsContent value="manual">{manual}</TabsContent>
    </Tabs>
  );
}
