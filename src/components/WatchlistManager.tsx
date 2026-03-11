import { useState } from "react";
import { List, Plus, Pencil, Trash2, Check, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Watchlist } from "@/hooks/useWatchlists";

interface WatchlistManagerProps {
  watchlists: Watchlist[];
  activeWatchlistId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const WatchlistManager = ({
  watchlists,
  activeWatchlistId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: WatchlistManagerProps) => {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  if (!user) return null;

  const activeList = watchlists.find(w => w.id === activeWatchlistId);

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName("");
      setCreateOpen(false);
    }
  };

  const handleRename = () => {
    if (renameId && renameName.trim()) {
      onRename(renameId, renameName.trim());
      setRenameId(null);
      setRenameName("");
      setRenameOpen(false);
    }
  };

  const openRename = (id: string, currentName: string) => {
    setRenameId(id);
    setRenameName(currentName);
    setRenameOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline max-w-[120px] truncate">
              {activeList?.name || "Lists"}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {watchlists.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No watchlists yet. Create one!
            </div>
          )}
          {watchlists.map(wl => (
            <DropdownMenuItem
              key={wl.id}
              className="flex items-center justify-between group cursor-pointer"
              onSelect={(e) => {
                e.preventDefault();
                onSelect(wl.id);
              }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {wl.id === activeWatchlistId && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <span className={`truncate ${wl.id !== activeWatchlistId ? "ml-5" : ""}`}>
                  {wl.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  ({wl.tickers.length})
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openRename(wl.id, wl.name);
                  }}
                  className="p-1 rounded hover:bg-accent"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {watchlists.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(wl.id);
                    }}
                    className="p-1 rounded hover:bg-destructive/20 text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setCreateOpen(true);
            }}
            className="cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-2" />
            New Watchlist
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Create Watchlist</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Watchlist name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Rename Watchlist</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="New name"
            value={renameName}
            onChange={e => setRenameName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleRename} disabled={!renameName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WatchlistManager;
