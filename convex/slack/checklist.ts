import type { ChecklistItem } from "../mondayDm/questsCopy";

const marks: Record<ChecklistItem["mark"], { type: "emoji"; name: string; skin_tone?: number }> = {
  done: { type: "emoji", name: "white_check_mark" },
  next: { type: "emoji", name: "point_right", skin_tone: 2 },
  open: { type: "emoji", name: "white_circle" },
};

export function checklistBlockOf(checklist: ChecklistItem[]) {
  return { type: "rich_text", elements: [{ type: "rich_text_list", style: "bullet", indent: 0, elements: checklist.map(checklistItemOf) }] };
}

function checklistItemOf({ goal, mark, progress }: ChecklistItem) {
  const goalText = { type: "text", text: ` ${goal}`, style: { bold: mark === "next", strike: mark === "done" } };
  const progressText = progress === null ? [] : [{ type: "text", text: `  ${progress}`, style: { italic: true } }];
  return { type: "rich_text_section", elements: [marks[mark], goalText, ...progressText] };
}
