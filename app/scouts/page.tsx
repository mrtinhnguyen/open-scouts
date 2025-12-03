"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Plus, Trash2, MapPin, Clock, Eye } from "lucide-react";
import Button from "@/components/ui/shadcn/button";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { Connector } from "@/components/shared/layout/curvy-rect";
import SymbolColored from "@/components/shared/icons/symbol-colored";
import { useAuth } from "@/contexts/AuthContext";

type Scout = {
  id: string;
  title: string;
  description: string;
  goal: string;
  search_queries: string[];
  location: {
    city: string;
    state?: string;
    country?: string;
    latitude: number;
    longitude: number;
  } | null;
  frequency: "hourly" | "every_3_days" | "weekly" | null;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

type Location = {
  city: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

export default function ScoutsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scoutToDelete, setScoutToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Load user's location from preferences
  useEffect(() => {
    const loadUserLocation = async () => {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from("user_preferences")
          .select("location")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data?.location) {
          // Convert from UserLocation format to scout Location format
          const userLoc = data.location;
          setLocation({
            city: userLoc.city || userLoc.country || "Unknown",
            state: userLoc.state || undefined,
            country: userLoc.country || undefined,
            latitude: userLoc.latitude || 0,
            longitude: userLoc.longitude || 0,
          });
        }
      } catch (error) {
        console.error("Error loading user location:", error);
      }
    };

    loadUserLocation();
  }, [user?.id]);

  const loadScouts = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("scouts")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setScouts(data);
    setLoading(false);
  };

  const createNewScout = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("scouts")
      .insert({
        title: "New Scout",
        location: location,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating scout:", error);
      return;
    }

    if (data) {
      router.push(`/scout/${data.id}`);
    }
  };

  const openDeleteDialog = (scout: Scout, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when clicking delete
    setScoutToDelete({ id: scout.id, title: scout.title });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteScout = async () => {
    if (!scoutToDelete) return;

    const { error } = await supabase
      .from("scouts")
      .delete()
      .eq("id", scoutToDelete.id);

    if (error) {
      console.error("Error deleting scout:", error);
      return;
    }

    setDeleteDialogOpen(false);
    setScoutToDelete(null);
    await loadScouts();
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setScoutToDelete(null);
  };

  useEffect(() => {
    if (user?.id) {
      loadScouts();
    }
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background-base">
      {/* Top border line */}
      <div className="h-1 w-full bg-border-faint" />

      <div className="container relative">
        {/* Corner connectors */}
        <Connector className="absolute -top-10 -left-[10.5px]" />
        <Connector className="absolute -top-10 -right-[10.5px]" />

        {/* Header Section */}
        <div className="py-48 lg:py-64 relative">
          {/* Bottom border */}
          <div className="h-1 bottom-0 absolute w-screen left-[calc(50%-50vw)] bg-border-faint" />
          <Connector className="absolute -bottom-10 -left-[10.5px]" />
          <Connector className="absolute -bottom-10 -right-[10.5px]" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-24 px-24">
            <div>
              <h1 className="text-title-h3 lg:text-title-h2 font-semibold text-accent-black">
                Your Scouts
              </h1>
              <p className="text-body-large text-black-alpha-56 mt-4">
                Manage your AI scouts that continuously search and notify you
              </p>
            </div>
            <Button
              onClick={createNewScout}
              size="large"
              className="flex items-center gap-8 shrink-0"
            >
              <Plus size={20} />
              New Scout
            </Button>
          </div>
        </div>

        {/* Section label */}
        <div className="py-24 lg:py-32 relative">
          <div className="h-1 bottom-0 absolute w-screen left-[calc(50%-50vw)] bg-border-faint" />

          <div className="flex items-center gap-16">
            <div className="w-2 h-16 bg-heat-100" />
            <div className="flex gap-12 items-center text-mono-x-small text-black-alpha-32 font-mono">
              <Eye className="w-14 h-14" />
              <span className="uppercase tracking-wider">All Scouts</span>
              {scouts.length > 0 && (
                <>
                  <span>·</span>
                  <span className="text-heat-100">{scouts.length} total</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pb-64">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-20">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-12 border border-border-faint overflow-hidden"
                >
                  <div className="p-20">
                    <div className="flex items-center gap-12 mb-12">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <Skeleton className="h-20 w-2/3" />
                    </div>
                    <Skeleton className="h-14 w-full mb-8" />
                    <Skeleton className="h-14 w-3/4 mb-16" />
                    <div className="flex items-center gap-8 mb-8">
                      <Skeleton className="w-12 h-12" />
                      <Skeleton className="h-12 w-80" />
                    </div>
                    <div className="flex items-center gap-8">
                      <Skeleton className="w-12 h-12" />
                      <Skeleton className="h-12 w-100" />
                    </div>
                  </div>
                  <div className="border-t border-border-faint px-20 py-12 bg-background-base">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-12 w-80" />
                      <Skeleton className="h-20 w-64 rounded-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : scouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-80 text-center">
              <SymbolColored className="w-48 h-auto mb-24 opacity-30" />
              <h2 className="text-title-h4 font-semibold text-accent-black mb-8">
                No scouts yet
              </h2>
              <p className="text-body-large text-black-alpha-56 mb-24 max-w-400">
                Create your first scout to start monitoring for updates
              </p>
              <Button onClick={createNewScout} size="large">
                <Plus size={20} className="mr-8" />
                Create Scout
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-20">
              {scouts.map((scout) => {
                const isComplete =
                  scout.title &&
                  scout.goal &&
                  scout.description &&
                  scout.location &&
                  scout.search_queries?.length > 0 &&
                  scout.frequency;

                return (
                  <div
                    key={scout.id}
                    className="bg-white rounded-12 border border-border-faint hover:border-black-alpha-16 hover:shadow-md transition-all cursor-pointer group flex flex-col overflow-hidden"
                    onClick={() =>
                      router.push(
                        isComplete ? `/${scout.id}` : `/scout/${scout.id}`,
                      )
                    }
                  >
                    <div className="p-20 relative flex-1">
                      {/* Delete button */}
                      <button
                        onClick={(e) => openDeleteDialog(scout, e)}
                        className="opacity-0 group-hover:opacity-100 p-8 hover:bg-black-alpha-4 rounded-6 transition absolute top-12 right-12"
                      >
                        <Trash2 size={16} className="text-black-alpha-48" />
                      </button>

                      {/* Title with status */}
                      <div className="flex items-center gap-10 mb-12 pr-32">
                        <div
                          className={`w-8 h-8 rounded-full flex-shrink-0 ${
                            scout.is_active ? "bg-green-500" : "bg-red-500"
                          }`}
                          title={scout.is_active ? "Active" : "Inactive"}
                        />
                        <h3 className="text-label-large font-semibold text-accent-black truncate">
                          {scout.title || "New Scout"}
                        </h3>
                      </div>

                      {/* Goal */}
                      {scout.goal && (
                        <p className="text-body-small text-black-alpha-56 mb-16 line-clamp-2">
                          {scout.goal}
                        </p>
                      )}

                      {/* Meta info */}
                      <div className="space-y-6">
                        {scout.location && (
                          <div className="flex items-center gap-8 text-mono-x-small font-mono text-black-alpha-40">
                            <MapPin className="w-12 h-12" />
                            <span>{scout.location.city}</span>
                          </div>
                        )}

                        {scout.last_run_at && (
                          <div className="flex items-center gap-8 text-mono-x-small font-mono text-black-alpha-40">
                            <Clock className="w-12 h-12" />
                            <span>
                              Last run:{" "}
                              {new Date(scout.last_run_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border-faint px-20 py-12 bg-background-base">
                      <div className="flex items-center justify-between">
                        <span className="text-mono-x-small font-mono text-black-alpha-32">
                          {new Date(scout.created_at).toLocaleDateString()}
                        </span>
                        {scout.frequency && (
                          <span className="text-mono-x-small font-mono text-heat-100 bg-heat-100/10 px-8 py-4 rounded-4 capitalize">
                            {scout.frequency.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="p-24">
          <DialogHeader>
            <DialogTitle>Delete Scout</DialogTitle>
            <DialogDescription className="mt-8">
              Are you sure you want to delete &quot;{scoutToDelete?.title}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-row gap-12 justify-end mt-24">
            <Button variant="secondary" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button onClick={confirmDeleteScout} variant="destructive">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
