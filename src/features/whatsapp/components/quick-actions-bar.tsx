import { Button } from "@/components/ui/button";
import { QUICK_ACTIONS } from "../data";
import { QUICK_ACTION_ICON } from "../icons";

export function QuickActionsBar() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_ACTIONS.map((action) => {
        const Icon = QUICK_ACTION_ICON[action.id];
        return (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 rounded-full px-2.5 text-[11px]"
            title={action.description}
          >
            <Icon className="h-3 w-3" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
