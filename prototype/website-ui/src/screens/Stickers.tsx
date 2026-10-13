// PROTOTYPE sticker book: a private sticker of each person thanked or thanking, and one album per group.
import { Avatar, AvatarFallback, Badge as Tag, Card, CardContent, Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle, Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "@posthog/quill";
import { IconLock } from "@posthog/icons";
import { Fragment } from "react";
import { albums, me, stickers } from "../data/mock";
import type { Album, Sticker } from "../data/types";
import { HedgehogCard, PageHeader } from "../ui";

const thanked = stickers.filter((s) => s.thanked);
const thankedMe = stickers.filter((s) => s.thankedMe);
const albumsMineFirst = [...albums].sort((a, b) => Number(b.mine) - Number(a.mine));

export function Stickers({ param }: { param?: string }) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Sticker book"
        hog={HedgehogCard}
        description={
          <>
            One sticker of each person you thank, and of each person who thanks you. Yours to keep, forever.{" "}
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <IconLock className="size-3.5" /> Only you can see it.
            </span>
          </>
        }
      />
      <StickerTabs initial={param === "thanked-me" ? "thanked-me" : "thanked"} />
      <Albums />
    </div>
  );
}

function StickerTabs({ initial }: { initial: string }) {
  return (
    <Tabs defaultValue={initial}>
      <TabsList variant="line">
        <TabsTrigger value="thanked">Thanked · {thanked.length}</TabsTrigger>
        <TabsTrigger value="thanked-me">Thanked me · {thankedMe.length}</TabsTrigger>
      </TabsList>
      <TabsContent value="thanked" className="pt-4">
        <StickerGrid stickers={thanked} />
      </TabsContent>
      <TabsContent value="thanked-me" className="pt-4">
        <StickerGrid stickers={thankedMe} />
      </TabsContent>
      <p className="mt-3 text-xs text-muted-foreground">Someone you've thanked who has also thanked you is on both pages.</p>
    </Tabs>
  );
}

function StickerGrid({ stickers: shown }: { stickers: Sticker[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {shown.map((s) => (
        <Card key={s.member.id} size="sm">
          <CardContent className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{s.member.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{s.member.name}</div>
              <div className="text-xs text-muted-foreground">since {s.since}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Albums() {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">Albums</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every group has one. Its pages are the group's members, apart from you, and a completed album stays complete. Completed albums count toward the{" "}
          <a href="#/achievements" className="text-foreground underline underline-offset-2">
            Team Spirit
          </a>{" "}
          achievement.
        </p>
      </div>
      <Card size="sm" flush>
        <ItemGroup>
          {albumsMineFirst.map((album, i) => (
            <Fragment key={album.group.id}>
              {i > 0 && <ItemSeparator />}
              <AlbumRow album={album} />
            </Fragment>
          ))}
        </ItemGroup>
      </Card>
    </section>
  );
}

function AlbumRow({ album }: { album: Album }) {
  const primary = album.group.id === me.primaryGroup.id;
  return (
    <Item>
      <ItemContent className="gap-2">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          {album.group.name}
          {primary && <span className="text-xs font-normal text-muted-foreground">Primary group</span>}
          {album.mine && !primary && <span className="text-xs font-normal text-muted-foreground">Your group</span>}
          {album.complete && <Tag variant="success">Complete</Tag>}
        </ItemTitle>
        <Progress value={album.held} max={album.pages} variant={album.complete ? "success" : "default"} className="max-w-md" aria-label={`${album.group.name} album`} />
        <ItemDescription>{album.complete ? "Every page filled." : `Still to swap thanks with ${album.missing.map((m) => m.name).join(", ")}`}</ItemDescription>
      </ItemContent>
      <ItemActions className="self-start text-sm tabular-nums">
        {album.held}/{album.pages}
      </ItemActions>
    </Item>
  );
}
