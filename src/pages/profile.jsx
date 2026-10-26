import { useRef, useState } from "react";
import { t } from "../i18n.js";
import { api } from "../api.js";
import { useSession } from "../session.jsx";
import { useWorkspace } from "../workspace.jsx";
import { Icon } from "../icons.jsx";
import { Dialog, Button, TextInput, Avatar, useToast, initialsOf } from "../ui.jsx";

const SIDE = 256;

/**
 * Turns a picked photo into a small square JPEG data: URL: centred crop, 256 px, so even a phone
 * photo ends up a few tens of KB. Anything the browser can draw works (HEIC too, in Safari).
 */
export async function readPhoto(file) {
  if (!file.type.startsWith("image/")) throw new Error(t("Choose a photo (JPEG, PNG or WebP)."));
  if (file.size > 15 * 1024 * 1024) throw new Error(t("The photo must be smaller than 15 MB."));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((done, fail) => {
      const i = new Image();
      i.onload = () => done(i);
      i.onerror = () => fail(new Error(t("Couldn't read that image.")));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIDE;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent PNGs get a white background, not black
    ctx.fillRect(0, 0, SIDE, SIDE);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIDE, SIDE);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Your own name and photo. Teammates see the photo in the Team list and the Inbox. */
export function ProfileDialog({ onClose }) {
  const { user, refresh } = useSession();
  const { reloadMembers } = useWorkspace();
  const toast = useToast();
  const input = useRef(null);
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    try {
      setAvatar(await readPhoto(file));
      setPhotoError("");
    } catch (e) {
      setPhotoError(e.message);
    }
  };
  const save = async () => {
    if (!name.trim()) return setError(t("Enter your name."));
    setBusy(true);
    try {
      await api("/auth/me", { method: "PATCH", body: { name: name.trim(), avatar } });
      await refresh();
      reloadMembers();
      toast(t("Profile saved"));
      onClose();
    } catch (e) {
      toast(e.message, { tone: "error" });
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={t("Your profile")}
      description={user.email}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            {t("Save")}
          </Button>
        </>
      }
    >
      <div className="profile-photo">
        <Avatar initials={initialsOf(name || user.name)} tone="t1" src={avatar || undefined} cover />
        <div className="profile-photo-actions">
          <input ref={input} id="profile-photo" type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => (pick(e.target.files[0]), (e.target.value = ""))} />
          <Button size="sm" icon="upload" onClick={() => input.current.click()}>
            {avatar ? t("Change photo") : t("Upload photo")}
          </Button>
          {avatar && (
            <Button size="sm" variant="ghost" onClick={() => setAvatar("")}>
              {t("Remove")}
            </Button>
          )}
        </div>
      </div>
      {photoError && (
        <span className="field-error" role="alert">
          <Icon name="alertCircle" size={13} />
          {photoError}
        </span>
      )}
      <TextInput id="profile-name" label={t("Your name")} value={name} maxLength={80} onChange={(e) => (setName(e.target.value), setError(""))} error={error || undefined} />
    </Dialog>
  );
}
