export function appHomeLink(workspace: string, label: string) {
  const query = new URLSearchParams({ team: workspace, id: appId(), tab: "home" });
  return `<slack://app?${query}|${label}>`;
}

function appId() {
  const id = process.env.SLACK_APP_ID;
  if (!id) throw new Error("SLACK_APP_ID is not set");
  return id;
}
