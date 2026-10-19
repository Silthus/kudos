import type { CSSProperties } from "react";
import type { Album } from "./answer";
import { TrayToken } from "./TrayPanel";
import { putInFlightMs, type Box, type Flight, type Touchdown } from "./usePuttingIn";

const sparkles = 8;

export function PutInFlights({ album, flights, touchdowns }: { album: Album; flights: Flight[]; touchdowns: Touchdown[] }) {
  if (flights.length === 0 && touchdowns.length === 0) return null;
  return (
    <div className="al-flights" aria-hidden="true">
      {flights.map(({ key, target }) => (
        <span key={`beckon:${key}`} className="al-beckon" data-beckon="" style={boxStyleOf(target, 6)} />
      ))}
      {touchdowns.map(({ key, target }) => (
        <span key={`touchdown:${key}`} className="al-touchdown" style={boxStyleOf(target)}>
          <span className="al-touchdown-ring" />
          {Array.from({ length: sparkles }, (_, index) => (
            <span key={index} className="al-touchdown-sparkle" style={sparkleStyleOf(index, target)} />
          ))}
        </span>
      ))}
      {flights.map((flight) => (
        <span key={flight.key} className="al-flight" data-to={flight.to} style={flightStyleOf(flight)}>
          <span className="al-flight-x">
            <span className="al-flight-y">
              <span className="al-flight-token">
                <TrayToken album={album} item={flight.item} />
              </span>
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

function centreOf({ left, top, width, height }: Box) {
  return { x: left + width / 2, y: top + height / 2 };
}

function flightStyleOf({ from, target }: Flight): CSSProperties {
  const start = centreOf(from);
  const end = centreOf(target);
  return { left: start.x, top: start.y, "--fly-x": `${Math.round(end.x - start.x)}px`, "--fly-y": `${Math.round(end.y - start.y)}px`, "--flight-ms": `${putInFlightMs}ms` } as CSSProperties;
}

function boxStyleOf(box: Box, grow = 0): CSSProperties {
  return { left: box.left - grow, top: box.top - grow, width: box.width + grow * 2, height: box.height + grow * 2 };
}

function sparkleStyleOf(index: number, box: Box): CSSProperties {
  const angle = (index / sparkles) * Math.PI * 2;
  const reach = Math.max(28, Math.max(box.width, box.height) * 0.7);
  return { "--x": `${Math.round(Math.cos(angle) * reach)}px`, "--y": `${Math.round(Math.sin(angle) * reach)}px` } as CSSProperties;
}
