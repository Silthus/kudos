import type { GroupId, GroupRef } from "../groups/groups";
import { plainText } from "./blocks";

const optionsPerList = 100;
const optionTextLength = 75;

export function groupSelectOf(actionId: string, groups: GroupRef[], picked: GroupId) {
  const options = groups.map(optionOf);
  const initial = options.find(({ value }) => value === picked);
  return {
    type: "static_select",
    action_id: actionId,
    placeholder: plainText("Pick a group"),
    ...(options.length <= optionsPerList ? { options } : { option_groups: optionGroupsOf(options) }),
    ...(initial !== undefined && { initial_option: initial }),
  };
}

type Option = ReturnType<typeof optionOf>;

function optionOf({ group, name }: GroupRef) {
  return { text: plainText(name.length <= optionTextLength ? name : `${name.slice(0, optionTextLength - 1)}…`), value: group };
}

function optionGroupsOf(options: Option[]) {
  const lists = Array.from({ length: Math.ceil(options.length / optionsPerList) }, (_, index) => options.slice(index * optionsPerList, (index + 1) * optionsPerList));
  return lists.map((list, index) => ({ label: plainText(`Groups ${index * optionsPerList + 1}–${index * optionsPerList + list.length}`), options: list }));
}
