// PROTOTYPE (#625, round 4): the pack opening, the pocket binder's card flips with more celebration. Never merge to main.
import { useNavigate } from "../../../AppLink";

export function PackOpening() {
  const navigate = useNavigate();
  return (
    <div className="r4-opening" role="dialog" aria-label="Open your packs">
      <p>Pack opening: being built.</p>
      <button type="button" onClick={() => navigate(window.location.pathname)}>
        Close
      </button>
    </div>
  );
}
