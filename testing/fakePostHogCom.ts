import type { ScriptedAnswer } from "./fakeSlack";

export type TeamPageProfile = {
  id: number;
  firstName: string;
  lastName: string;
  colour?: string | null;
  cutout?: string | null;
};

export type TeamPage = { slug: string | null; profiles: TeamPageProfile[] };

const host = "better-animal-d658c56969.strapiapp.com";

export const aCutout = (file: string) => `https://res.cloudinary.com/posthog-test/image/upload/v1/${file}.png`;

export class FakePostHogCom {
  private teams: TeamPage[] = [];
  private pageSize = 100;
  private readonly scripted = new Map<number, ScriptedAnswer>();

  owns(url: URL) {
    return url.host === host;
  }

  withTeams(...teams: TeamPage[]) {
    this.teams = teams;
    return this;
  }

  pagedBy(pageSize: number) {
    this.pageSize = pageSize;
    return this;
  }

  answersPage(page: number, answer: ScriptedAnswer) {
    this.scripted.set(page, answer);
    return this;
  }

  readonly fetch = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname !== "/api/teams") return new Response("not found", { status: 404 });
    const page = Number(url.searchParams.get("pagination[page]") ?? "1");
    const asPostHogComWould = () => Response.json(this.page(page));
    const scripted = this.scripted.get(page);
    return scripted === undefined ? asPostHogComWould() : scripted(asPostHogComWould);
  };

  private page(page: number) {
    const pageCount = Math.max(1, Math.ceil(this.teams.length / this.pageSize));
    const teams = this.teams.slice((page - 1) * this.pageSize, page * this.pageSize);
    return {
      data: teams.map((team, index) => ({ id: index + 1, attributes: { slug: team.slug, profiles: { data: team.profiles.map(asStrapiProfile) } } })),
      meta: { pagination: { page, pageSize: this.pageSize, pageCount, total: this.teams.length } },
    };
  }
}

function asStrapiProfile({ id, firstName, lastName, colour, cutout }: TeamPageProfile) {
  return {
    id,
    attributes: {
      firstName,
      lastName,
      color: colour ?? null,
      avatar: { data: cutout ? { id, attributes: { url: cutout } } : null },
    },
  };
}
