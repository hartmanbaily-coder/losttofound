// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import QRCode from "react-qr-code";

type PetStatus = "home" | "lost" | "found";
type Plan = "free" | "plus";

interface Pet {
  id: string;
  name: string;
  slug: string;
  status: PetStatus;
  photo_url: string | null;
  photo_url_2: string | null;
  photo_url_3: string | null;
  description: string | null;
  behavior_notes: string | null;
  contact_email_primary: string | null;
  contact_email_backup: string | null;
  contact_phone_primary: string | null;
  contact_phone_backup: string | null;
  // Travel mode fields
  is_travel_mode: boolean;
  travel_city: string | null;
  travel_region: string | null;
  travel_radius_km: number | null;
  travel_notes: string | null;
}

interface FinderMessage {
  id: string;
  pet_id: string;
  message: string;
  general_location: string | null;
  created_at: string;
}

type TravelField =
  | "is_travel_mode"
  | "travel_city"
  | "travel_region"
  | "travel_radius_km"
  | "travel_notes";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [pets, setPets] = useState<Pet[]>([]);
  const [finderMessages, setFinderMessages] = useState<FinderMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [uploadingPetId, setUploadingPetId] = useState<string | null>(null);

  // Load current user
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Load plan, pets, and finder messages
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadEverything = async () => {
      setLoading(true);
      setError(null);

      // 1) Plan from user_profiles
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        if (profileError) {
          console.error("Error loading user profile:", profileError);
        } else if (profile && profile.plan) {
          setPlan((profile.plan as Plan) ?? "free");
        }
      }

      // 2) Pets
      const { data: petData, error: petsError } = await supabase
        .from("pets")
        .select(
          `
          id,
          name,
          slug,
          status,
          photo_url,
          photo_url_2,
          photo_url_3,
          description,
          behavior_notes,
          contact_email_primary,
          contact_email_backup,
          contact_phone_primary,
          contact_phone_backup,
          is_travel_mode,
          travel_city,
          travel_region,
          travel_radius_km,
          travel_notes
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (petsError) {
        console.error(petsError);
        setError("Could not load your pets. Please try again.");
        setLoading(false);
        return;
      }

      const typedPets = (petData as Pet[]) ?? [];
      setPets(typedPets);

      // 3) Finder messages for these pets
      if (typedPets.length > 0) {
        const petIds = typedPets.map((p) => p.id);

        const { data: msgData, error: msgError } = await supabase
          .from("finder_messages")
          .select("id, pet_id, message, general_location, created_at")
          .in("pet_id", petIds)
          .order("created_at", { ascending: false });

        if (cancelled) return;

        if (msgError) {
          console.error("Error loading finder messages:", msgError);
        } else {
          setFinderMessages((msgData as FinderMessage[]) ?? []);
        }
      } else {
        setFinderMessages([]);
      }

      setLoading(false);
    };

    loadEverything();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleAddPet = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newName.trim()) {
      setError("Pet name is required.");
      return;
    }

    // Free plan: one pet max
    if (plan === "free" && pets.length >= 1) {
      setError(
        "The Free plan is limited to one pet. Upgrade to Plus to add more pets."
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const slug = slugify(newName);
      const { data, error } = await supabase
        .from("pets")
        .insert({
          user_id: user.id,
          name: newName.trim(),
          slug,
          description: newDescription.trim() || null,
          status: "home",
        })
        .select(
          `
          id,
          name,
          slug,
          status,
          photo_url,
          photo_url_2,
          photo_url_3,
          description,
          behavior_notes,
          contact_email_primary,
          contact_email_backup,
          contact_phone_primary,
          contact_phone_backup,
          is_travel_mode,
          travel_city,
          travel_region,
          travel_radius_km,
          travel_notes
        `
        )
        .single();

      if (error) throw error;
      setPets((prev) => [...prev, data as Pet]);
      setNewName("");
      setNewDescription("");
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Could not add pet. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (petId: string, status: PetStatus) => {
    setError(null);
    const previous = [...pets];
    setPets((current) =>
      current.map((p) => (p.id === petId ? { ...p, status } : p))
    );

    const { error } = await supabase
      .from("pets")
      .update({ status })
      .eq("id", petId);

    if (error) {
      console.error(error);
      setError("Could not update status. Reverting.");
      setPets(previous);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";

  const handleUploadPhotos = async (petId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!user) return;

    setError(null);
    setUploadingPetId(petId);

    try {
      const toUpload = Array.from(files).slice(0, 3);

      const uploadedUrls: string[] = [];

      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${petId}/${Date.now()}-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("pet-photos")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: publicData } = supabase.storage
          .from("pet-photos")
          .getPublicUrl(path);

        if (publicData?.publicUrl) {
          uploadedUrls.push(publicData.publicUrl);
        }
      }

      if (uploadedUrls.length === 0) {
        setError("Could not upload photos. Please try again.");
        return;
      }

      const current = pets.find((p) => p.id === petId);
      const updates: Partial<Pet> = {};

      if (uploadedUrls[0]) {
        updates.photo_url = uploadedUrls[0];
      }
      if (uploadedUrls[1]) {
        updates.photo_url_2 = uploadedUrls[1];
      }
      if (uploadedUrls[2]) {
        updates.photo_url_3 = uploadedUrls[2];
      }

      const { error: updateError } = await supabase
        .from("pets")
        .update({
          photo_url: updates.photo_url ?? current?.photo_url ?? null,
          photo_url_2: updates.photo_url_2 ?? current?.photo_url_2 ?? null,
          photo_url_3: updates.photo_url_3 ?? current?.photo_url_3 ?? null,
        })
        .eq("id", petId);

      if (updateError) {
        console.error("Error saving photo URLs:", updateError);
        setError("Photos uploaded but could not save to pet profile.");
        return;
      }

      setPets((prev) =>
        prev.map((p) =>
          p.id === petId
            ? {
                ...p,
                photo_url: updates.photo_url ?? p.photo_url,
                photo_url_2: updates.photo_url_2 ?? p.photo_url_2,
                photo_url_3: updates.photo_url_3 ?? p.photo_url_3,
              }
            : p
        )
      );
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong while uploading photos.");
    } finally {
      setUploadingPetId(null);
    }
  };

  const handleDeletePhoto = async (petId: string, slot: 1 | 2 | 3) => {
    setError(null);
    const fieldMap: Record<number, keyof Pet> = {
      1: "photo_url",
      2: "photo_url_2",
      3: "photo_url_3",
    };

    const field = fieldMap[slot];
    try {
      const { error: updateError } = await supabase
        .from("pets")
        .update({ [field]: null })
        .eq("id", petId);

      if (updateError) {
        console.error("Error deleting photo:", updateError);
        setError("Could not delete that photo. Please try again.");
        return;
      }

      setPets((prev) =>
        prev.map((p) => (p.id === petId ? { ...p, [field]: null } : p))
      );
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong while deleting the photo.");
    }
  };

  const handleContactFieldChange = (
    petId: string,
    field:
      | "contact_email_primary"
      | "contact_email_backup"
      | "contact_phone_primary"
      | "contact_phone_backup",
    value: string
  ) => {
    setPets((prev) =>
      prev.map((p) =>
        p.id === petId
          ? {
              ...p,
              [field]: value,
            }
          : p
      )
    );
  };

  const handleSaveContacts = async (petId: string) => {
    if (plan !== "plus") return;
    const pet = pets.find((p) => p.id === petId);
    if (!pet) return;

    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("pets")
        .update({
          contact_email_primary: pet.contact_email_primary || null,
          contact_email_backup: pet.contact_email_backup || null,
          contact_phone_primary: pet.contact_phone_primary || null,
          contact_phone_backup: pet.contact_phone_backup || null,
        })
        .eq("id", petId);

      if (updateError) {
        console.error("Error saving contacts:", updateError);
        setError("Could not save contacts. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong while saving contacts.");
    }
  };

  const handleTravelFieldChange = (
    petId: string,
    field: TravelField,
    value: string | number | boolean | null
  ) => {
    setPets((prev) =>
      prev.map((p) =>
        p.id === petId
          ? {
              ...p,
              [field]: value as any,
            }
          : p
      )
    );
  };

  const handleSaveTravelSettings = async (petId: string) => {
    if (plan !== "plus") return;
    const pet = pets.find((p) => p.id === petId);
    if (!pet) return;

    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("pets")
        .update({
          is_travel_mode: !!pet.is_travel_mode,
          travel_city: pet.travel_city || null,
          travel_region: pet.travel_region || null,
          travel_radius_km:
            typeof pet.travel_radius_km === "number"
              ? pet.travel_radius_km
              : null,
          travel_notes: pet.travel_notes || null,
        })
        .eq("id", petId);

      if (updateError) {
        console.error("Error saving travel settings:", updateError);
        setError("Could not save travel mode. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong while saving travel mode.");
    }
  };

  // Basic analytics derived from pets + finderMessages
  const totalPets = pets.length;
  const lostPets = pets.filter((p) => p.status === "lost").length;
  const travelModePets = pets.filter((p) => p.is_travel_mode).length;
  const totalMessages = finderMessages.length;

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  const messagesLast7Days = finderMessages.filter((m) => {
    const ts = new Date(m.created_at).getTime();
    return now - ts <= weekMs;
  }).length;

  const messagesLast30Days = finderMessages.filter((m) => {
    const ts = new Date(m.created_at).getTime();
    return now - ts <= monthMs;
  }).length;

  const latestMessage = finderMessages[0] ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-100 px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-50">
              LostToFound Dashboard
            </h1>
            <p className="text-sm text-neutral-300">
              Manage your pets and their lost or found status from one place.
              Only you can see this dashboard when you are signed in.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-neutral-300 hover:text-neutral-50 underline underline-offset-4"
          >
            Log out
          </button>
        </header>

        {/* Current plan banner */}
        <section className="rounded-2xl border border-brand-border bg-black/45 px-4 py-3 space-y-3 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm">
                <span className="mr-2 text-neutral-200">Current plan:</span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold border ${
                    plan === "plus"
                      ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/50"
                  }`}
                >
                  {plan === "plus" ? "Plus" : "Free"}
                </span>
              </p>
              <p className="text-xs text-neutral-300">
                {plan === "plus"
                  ? "You can add unlimited pets, use travel mode, and open lost posters for each pet."
                  : "Free covers one pet. Plus unlocks unlimited pets, travel mode, lost posters, and extra contact fields."}
              </p>
              <p className="text-[11px] text-neutral-400">
                Public pet pages never show your email, phone, or exact address.
                Messages from finders arrive here in your dashboard only.
              </p>
            </div>
          </div>

          <p className="text-xs text-neutral-300">
            To make a physical tag open this dashboard and use the QR code under
            each pet below. You can print the page or save a picture of the
            code and use it when you order a collar tag.
          </p>

          <div className="flex flex-wrap gap-2 justify-start sm:justify-end pt-1">
            <button
              onClick={() => router.push("/billing")}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400 transition"
            >
              {plan === "plus" ? "Open billing" : "See Plus plan"}
            </button>
            <button
              onClick={() => router.push("/lost")}
              className="inline-flex items-center justify-center rounded-full border border-emerald-500/70 px-4 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10 transition"
            >
              View lost pets board
            </button>
            <a
              href="https://amzn.to/4oNgs5d"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-emerald-500/70 px-4 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
            >
              Order tag blanks on Amazon
            </a>
          </div>
        </section>

        {/* Add pet */}
        <section className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-xl backdrop-blur-sm">
          <h2 className="text-lg font-medium mb-3 text-neutral-50">Add a pet</h2>
          <p className="text-sm text-neutral-300 mb-4">
            This creates a pet profile and a shareable link you can post in
            Facebook groups, texts, or on posters.
          </p>
          <form onSubmit={handleAddPet} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm mb-1" htmlFor="pet-name">
                  Pet name
                </label>
                <input
                  id="pet-name"
                  type="text"
                  className="w-full rounded-lg border border-brand-border bg-black/35 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-brand-accent"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Luna, Gus, Bear..."
                />
              </div>
              <div>
                <label
                  className="block text-sm mb-1"
                  htmlFor="pet-description"
                >
                  Short description optional
                </label>
                <input
                  id="pet-description"
                  type="text"
                  className="w-full rounded-lg border border-brand-border bg-black/35 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-brand-accent"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brown husky mix with blue collar"
                />
              </div>
            </div>

            {plan === "free" && (
              <p className="text-[11px] text-amber-200 bg-amber-900/30 border border-amber-600/60 rounded-md px-3 py-2">
                The Free plan is limited to one pet. Upgrade to Plus to add
                more pets, use travel mode, and generate lost posters.
              </p>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-700 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center rounded-lg bg-brand-accent text-black font-medium px-4 py-2 text-sm hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Add pet"}
            </button>
          </form>
        </section>

        {/* Your pets */}
        <section className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-medium text-neutral-50">Your pets</h2>
          </div>
          <p className="text-[11px] text-neutral-400 mb-3">
            Messages and sightings shown under each pet come from that pet&apos;s
            public page. They are only visible when you are signed in.
          </p>

          {loading ? (
            <p className="text-sm text-neutral-300">Loading your pets…</p>
          ) : pets.length === 0 ? (
            <p className="text-sm text-neutral-300">
              No pets added yet. Add your first pet above to generate a
              shareable profile link.
            </p>
          ) : (
            <ul className="space-y-3">
              {pets.map((pet) => {
                const petMessages = finderMessages
                  .filter((m) => m.pet_id === pet.id)
                  .slice(0, 3);

                const publicUrl = `${origin}/p/${pet.slug}`;

                const photos = [
                  pet.photo_url,
                  pet.photo_url_2,
                  pet.photo_url_3,
                ].filter((p): p is string => !!p);

                return (
                  <li
                    key={pet.id}
                    className="space-y-3 rounded-xl border border-brand-border bg-black/45 px-3 py-3"
                  >
                    {/* Top row: core info and actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-50">
                            {pet.name}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              pet.status === "lost"
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : pet.status === "found"
                                ? "bg-yellow-500/20 text-yellow-200 border border-yellow-500/40"
                                : "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                            }`}
                          >
                            {pet.status.toUpperCase()}
                          </span>
                          {pet.is_travel_mode && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-sky-500/20 text-sky-200 border border-sky-500/50">
                              Travel mode
                            </span>
                          )}
                        </div>
                        {pet.description && (
                          <p className="text-xs text-neutral-300 mt-1 line-clamp-2">
                            {pet.description}
                          </p>
                        )}
                        <p className="text-[11px] text-neutral-400 mt-1 break-all">
                          Public link:{" "}
                          <span className="font-mono text-neutral-200">
                            {publicUrl}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => router.push(`/p/${pet.slug}`)}
                          className="text-xs px-3 py-1 rounded-lg border border-brand-border hover:border-brand-accent hover:text-brand-accent transition"
                        >
                          View public page
                        </button>
                        <button
                          onClick={() => handleStatusChange(pet.id, "lost")}
                          className="text-xs px-3 py-1 rounded-lg border border-red-600/60 text-red-300 hover:bg-red-600/10 transition"
                        >
                          Mark LOST
                        </button>
                        <button
                          onClick={() => handleStatusChange(pet.id, "home")}
                          className="text-xs px-3 py-1 rounded-lg border border-emerald-500/70 text-emerald-200 hover:bg-emerald-500/10 transition"
                        >
                          Mark HOME
                        </button>
                        <button
                          onClick={() => handleStatusChange(pet.id, "found")}
                          className="text-xs px-3 py-1 rounded-lg border border-yellow-500/70 text-yellow-200 hover:bg-yellow-500/10 transition"
                        >
                          Mark FOUND
                        </button>
                        {plan === "plus" && (
                          <button
                            onClick={() => router.push(`/poster/${pet.slug}`)}
                            className="text-xs px-3 py-1 rounded-lg border border-brand-border hover:border-brand-accent hover:text-brand-accent transition"
                          >
                            Open lost poster
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Photos section */}
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                          Photos
                        </h3>
                        {photos.length > 0 && (
                          <p className="text-[10px] text-neutral-500">
                            Up to 3 photos shown on your public page and lost
                            board.
                          </p>
                        )}
                      </div>

                      {photos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {photos.map((url, idx) => (
                            <div
                              key={idx}
                              className="relative h-16 rounded-lg overflow-hidden border border-slate-800 bg-black/60"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`${pet.name} photo ${idx + 1}`}
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeletePhoto(
                                    pet.id,
                                    (idx + 1) as 1 | 2 | 3
                                  )
                                }
                                className="absolute top-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-neutral-200 hover:bg-red-600/80"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className="inline-flex items-center justify-center rounded-full border border-brand-border px-3 py-1.5 text-[11px] font-medium text-neutral-100 hover:border-brand-accent hover:text-brand-accent cursor-pointer transition w-fit">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) =>
                              handleUploadPhotos(pet.id, e.target.files)
                            }
                          />
                          {uploadingPetId === pet.id
                            ? "Uploading photos…"
                            : "Upload or update photos"}
                        </label>
                        <p className="text-[10px] text-neutral-500">
                          You can select up to 3 photos. New uploads will update
                          the photo slots used on your public pet page and the
                          lost pets board.
                        </p>
                      </div>
                    </div>

                    {/* Contact options (Plus feature) */}
                    <div className="mt-2 rounded-lg border border-brand-border/70 bg-black/45 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-neutral-200">
                          Contact options
                        </h3>
                        {plan !== "plus" && (
                          <span className="text-[10px] text-neutral-500">
                            Upgrade to Plus to edit
                          </span>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1">
                            Primary email
                          </label>
                          <input
                            type="email"
                            value={pet.contact_email_primary || ""}
                            onChange={(e) =>
                              handleContactFieldChange(
                                pet.id,
                                "contact_email_primary",
                                e.target.value
                              )
                            }
                            disabled={plan !== "plus"}
                            className="w-full rounded-md border border-brand-border bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-brand-accent disabled:opacity-60"
                            placeholder="you@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1">
                            Backup email
                          </label>
                          <input
                            type="email"
                            value={pet.contact_email_backup || ""}
                            onChange={(e) =>
                              handleContactFieldChange(
                                pet.id,
                                "contact_email_backup",
                                e.target.value
                              )
                            }
                            disabled={plan !== "plus"}
                            className="w-full rounded-md border border-brand-border bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-brand-accent disabled:opacity-60"
                            placeholder="backup@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1">
                            Primary phone
                          </label>
                          <input
                            type="tel"
                            value={pet.contact_phone_primary || ""}
                            onChange={(e) =>
                              handleContactFieldChange(
                                pet.id,
                                "contact_phone_primary",
                                e.target.value
                              )
                            }
                            disabled={plan !== "plus"}
                            className="w-full rounded-md border border-brand-border bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-brand-accent disabled:opacity-60"
                            placeholder="Main phone"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1">
                            Backup phone
                          </label>
                          <input
                            type="tel"
                            value={pet.contact_phone_backup || ""}
                            onChange={(e) =>
                              handleContactFieldChange(
                                pet.id,
                                "contact_phone_backup",
                                e.target.value
                              )
                            }
                            disabled={plan !== "plus"}
                            className="w-full rounded-md border border-brand-border bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-brand-accent disabled:opacity-60"
                            placeholder="Backup phone"
                          />
                        </div>
                      </div>
                      {plan === "plus" && (
                        <button
                          type="button"
                          onClick={() => handleSaveContacts(pet.id)}
                          className="mt-1 inline-flex items-center rounded-full bg-brand-accent px-3 py-1.5 text-[11px] font-medium text-black hover:bg-emerald-400 transition"
                        >
                          Save contacts
                        </button>
                      )}
                      <p className="text-[10px] text-neutral-500 mt-1">
                        These contacts are stored with this pet and never shown
                        on the public page. They are for your own records and
                        for future tools that help notify you faster.
                      </p>
                    </div>

                    {/* Travel mode (Plus feature) */}
                    <div className="mt-2 rounded-lg border border-sky-700/60 bg-sky-950/35 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-neutral-200">
                          Travel mode
                        </h3>
                        {plan !== "plus" ? (
                          <span className="text-[10px] text-neutral-500">
                            Plus plan feature
                          </span>
                        ) : (
                          <label className="inline-flex items-center gap-2 text-[11px] text-neutral-200">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border border-sky-500 bg-black/60"
                              checked={!!pet.is_travel_mode}
                              onChange={(e) =>
                                handleTravelFieldChange(
                                  pet.id,
                                  "is_travel_mode",
                                  e.target.checked
                                )
                              }
                            />
                            <span>
                              Travel mode {pet.is_travel_mode ? "on" : "off"}
                            </span>
                          </label>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        When you are away from home, switch this on and set the
                        area you are staying in so finders know this pet is
                        traveling with you.
                      </p>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] text-neutral-400 mb-1">
                            Travel city
                          </label>
                          <input
                            type="text"
                            value={pet.travel_city || ""}
                            onChange={(e) =>
                              handleTravelFieldChange(
                                pet.id,
                                "travel_city",
                                e.target.value
                              )
                            }
                            disabled={plan !== "plus"}
                            className="w-full rounded-md border border-sky-700 bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
                            placeholder="Boise"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] text-neutral-400 mb-1">
                            Region or state
                          </label>
                          <input
                            type="text"
                            value={pet.travel_region || ""}
                            onChange={(e) =>
                              handleTravelFieldChange(
                                pet.id,
                                "travel_region",
                                e.target.value
                              )
                            }
                            disabled={plan !== "plus"}
                            className="w-full rounded-md border border-sky-700 bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
                            placeholder="Idaho"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] text-neutral-400 mb-1">
                            Travel radius km optional
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={
                              typeof pet.travel_radius_km === "number"
                                ? pet.travel_radius_km
                                : ""
                            }
                            onChange={(e) =>
                              handleTravelFieldChange(
                                pet.id,
                                "travel_radius_km",
                                e.target.value
                                  ? Number(e.target.value)
                                  : null
                              )
                            }
                            disabled={plan !== "plus"}
                            className="w-full rounded-md border border-sky-700 bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
                            placeholder="10"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">
                          Notes optional
                        </label>
                        <textarea
                          value={pet.travel_notes || ""}
                          onChange={(e) =>
                            handleTravelFieldChange(
                              pet.id,
                              "travel_notes",
                              e.target.value
                            )
                          }
                          disabled={plan !== "plus"}
                          rows={2}
                          className="w-full rounded-md border border-sky-700 bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 resize-none"
                          placeholder="Staying at the Oakwood RV park near the south entrance."
                        />
                      </div>

                      {plan === "plus" && (
                        <button
                          type="button"
                          onClick={() => handleSaveTravelSettings(pet.id)}
                          className="mt-1 inline-flex items-center rounded-full bg-sky-500 px-3 py-1.5 text-[11px] font-medium text-black hover:bg-sky-400 transition"
                        >
                          Save travel settings
                        </button>
                      )}
                      {plan !== "plus" && (
                        <p className="text-[10px] text-neutral-500 mt-1">
                          Travel mode is part of the Plus household plan. It is
                          designed for road trips, camping, and travel days so
                          your pet profile matches where you are staying.
                        </p>
                      )}
                    </div>

                    {/* QR block */}
                    <div className="rounded-xl border border-brand-border bg-black/60 px-3 py-3 flex flex-col items-center sm:items-start sm:flex-row sm:justify-between gap-3">
                      <p className="text-[10px] text-neutral-300 max-w-xs">
                        Scan this code to open this pet page. You can copy this
                        into a tag order or print it as a backup label.
                      </p>
                      <div className="bg-white rounded-xl p-2">
                        <QRCode
                          value={publicUrl}
                          size={80}
                          style={{
                            height: "auto",
                            maxWidth: "100%",
                            width: "100%",
                          }}
                        />
                      </div>
                    </div>

                    {/* Recent sightings */}
                    <div className="mt-2 rounded-lg border border-brand-border/70 bg-black/45 px-3 py-2">
                      <h3 className="text-xs font-semibold text-neutral-200 mb-1">
                        Recent sightings
                      </h3>
                      {petMessages.length === 0 ? (
                        <p className="text-[11px] text-neutral-400">
                          No recent sightings yet. When someone uses the public
                          page to send a message, it will show here.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {petMessages.map((msg) => (
                            <li
                              key={msg.id}
                              className="flex items-start justify-between gap-3 text-[11px]"
                            >
                              <div className="flex-1">
                                <p className="text-neutral-50">
                                  {msg.message}
                                </p>
                                {msg.general_location && (
                                  <p className="text-neutral-300">
                                    <span className="opacity-70">Area:</span>{" "}
                                    {msg.general_location}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 text-neutral-400">
                                {new Date(msg.created_at).toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Traffic overview (basic analytics) */}
        <section className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-neutral-50">
                Traffic overview
              </h2>
              <p className="text-[11px] text-neutral-400">
                A quick picture of how your tags and public pet pages have been
                used recently.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-xl border border-brand-border bg-black/40 px-3 py-2">
              <p className="text-[10px] text-neutral-400">Pets on account</p>
              <p className="mt-1 text-xl font-semibold text-neutral-50">
                {totalPets}
              </p>
              <p className="text-[11px] text-neutral-400">
                {lostPets} currently marked lost
              </p>
            </div>
            <div className="rounded-xl border border-brand-border bg-black/40 px-3 py-2">
              <p className="text-[10px] text-neutral-400">Finder messages</p>
              <p className="mt-1 text-xl font-semibold text-neutral-50">
                {totalMessages}
              </p>
              <p className="text-[11px] text-neutral-400">
                {messagesLast7Days} in the last 7 days
              </p>
            </div>
            <div className="rounded-xl border border-brand-border bg-black/40 px-3 py-2">
              <p className="text-[10px] text-neutral-400">
                Messages last 30 days
              </p>
              <p className="mt-1 text-xl font-semibold text-neutral-50">
                {messagesLast30Days}
              </p>
              <p className="text-[11px] text-neutral-400">
                Includes all pets on this account
              </p>
            </div>
            <div className="rounded-xl border border-brand-border bg-black/40 px-3 py-2">
              <p className="text-[10px] text-neutral-400">Travel mode</p>
              <p className="mt-1 text-xl font-semibold text-neutral-50">
                {travelModePets}
              </p>
              <p className="text-[11px] text-neutral-400">
                Pet{travelModePets === 1 ? "" : "s"} with travel mode on
              </p>
            </div>
          </div>

          {latestMessage && (
            <p className="text-[11px] text-neutral-400">
              Last sighting message arrived{" "}
              <span className="text-neutral-100">
                {new Date(latestMessage.created_at).toLocaleString()}
              </span>
              .
            </p>
          )}
        </section>

        {/* Sightings timeline */}
        <section className="bg-brand-card border border-brand-border rounded-2xl p-4 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-neutral-50">
                Sightings timeline
              </h2>
              <p className="text-[11px] text-neutral-400">
                Recent messages from your public pet pages, newest first.
              </p>
            </div>
          </div>

          {finderMessages.length === 0 ? (
            <p className="text-sm text-neutral-300">
              No finder messages yet. When someone uses one of your public pet
              pages to send a message, it will show up here as well as under the
              matching pet.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {finderMessages.slice(0, 20).map((msg) => {
                const pet = pets.find((p) => p.id === msg.pet_id) || null;
                const created = new Date(msg.created_at);
                return (
                  <li
                    key={msg.id}
                    className="rounded-lg border border-brand-border bg-black/45 px-3 py-2 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-50 font-medium">
                          {pet?.name ?? "Unknown pet"}
                        </span>
                        {pet && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              pet.status === "lost"
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : pet.status === "found"
                                ? "bg-yellow-500/20 text-yellow-200 border border-yellow-500/40"
                                : "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                            }`}
                          >
                            {pet.status.toUpperCase()}
                          </span>
                        )}
                        {pet?.is_travel_mode && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-sky-500/20 text-sky-200 border border-sky-500/50">
                            Travel
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400 shrink-0">
                        {created.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-neutral-100 leading-snug">
                      {msg.message}
                    </p>
                    {msg.general_location && (
                      <p className="text-[11px] text-neutral-300">
                        <span className="opacity-70">Area:</span>{" "}
                        {msg.general_location}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}