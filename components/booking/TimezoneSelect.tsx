"use client";

import { useMemo } from "react";
import { Select } from "@/components/ui/Select";

interface TimezoneSelectProps {
  value: string;
  detected: string;
  onChange: (timezone: string) => void;
}

function zoneList(detected: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  const zones = new Set<string>(supported);
  zones.add(detected);
  zones.add("UTC");
  return Array.from(zones).sort();
}

export function TimezoneSelect({
  value,
  detected,
  onChange,
}: TimezoneSelectProps) {
  const zones = useMemo(() => zoneList(detected), [detected]);

  return (
    <Select
      label="Timezone"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {zone.replace(/_/g, " ")}
          {zone === detected ? " (detected)" : ""}
        </option>
      ))}
    </Select>
  );
}
