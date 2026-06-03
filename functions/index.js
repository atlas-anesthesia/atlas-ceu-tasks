// Cloud Functions for the tasks app — sends push notifications when tasks
// are added or reassigned to someone other than the person who made the change.

// must be set BEFORE any Date operations so all `new Date()` calls below
// use Central time instead of UTC
process.env.TZ = "America/Chicago";

const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

setGlobalOptions({ maxInstances: 10 });
initializeApp();

// ---------- helpers ----------

async function tokensForPerson(person) {
  const snap = await getFirestore()
    .collection("fcm_tokens")
    .where("person", "==", person)
    .get();

  logger.info(`tokensForPerson(${person}): found ${snap.size} doc(s)`);
  if (snap.empty) return { tokens: [], docs: [] };

  // Keep only the single most-recent token per person. Older entries are
  // assumed stale (re-subscriptions from cache clears, browser updates, etc.).
  // This effectively means "one device per person at a time" — re-subscribing
  // on a different device replaces the previous one.
  let mostRecent = null;
  for (const d of snap.docs) {
    const data = d.data();
    if (!data.token) continue;
    const created = data.createdAt || 0;
    if (!mostRecent || created > mostRecent.createdAt) {
      mostRecent = { token: data.token, doc: d, createdAt: created };
    }
  }
  if (!mostRecent) return { tokens: [], docs: [] };

  // delete every other token for this person
  const olderDocs = snap.docs.filter((d) => d.id !== mostRecent.doc.id);
  if (olderDocs.length) {
    try {
      const batch = getFirestore().batch();
      for (const d of olderDocs) batch.delete(d.ref);
      await batch.commit();
      logger.info(`pruned ${olderDocs.length} older tokens for ${person}`);
    } catch (err) {
      logger.warn("token prune failed:", err);
    }
  }

  return { tokens: [mostRecent.token], docs: [mostRecent.doc] };
}

async function sendTo(tokens, payload, docs) {
  if (!tokens.length) return;
  try {
    // include both notification (for iOS auto-display) and data (for click /
    // foreground handling). The SW does NOT call showNotification — the SDK
    // already auto-displays from the `notification` payload.
    const title = String((payload.notification && payload.notification.title) || "");
    const body = String((payload.notification && payload.notification.body) || "");
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { ...(payload.data || {}), title, body },
    });
    logger.info(`sent ${response.successCount}/${tokens.length} notifications`);

    // clean up dead tokens
    const dead = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          dead.push(i);
        }
      }
    });
    if (dead.length && docs) {
      const batch = getFirestore().batch();
      for (const i of dead) batch.delete(docs[i].ref);
      await batch.commit();
      logger.info(`cleaned up ${dead.length} stale tokens`);
    }
  } catch (err) {
    logger.error("send failed:", err);
  }
}

function trim(s, max = 80) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// ---------- triggers ----------

// new task or meeting — notify the recipient (if not the creator)
exports.onTaskCreated = onDocumentCreated("tasks/{taskId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const task = snap.data();
  if (!task) return;
  if (task.parentId) return; // sub-task — covered by its parent's notification
  if (!task.person || !task.addedBy) return;
  if (task.person === task.addedBy) return; // self-added — don't notify yourself

  // "both" meetings notify everyone except the creator
  let recipients;
  if (task.kind === "meeting" && task.person === "both") {
    recipients = ["oliver", "josh"].filter((p) => p !== task.addedBy);
  } else {
    recipients = [task.person];
  }

  for (const person of recipients) {
    const { tokens, docs } = await tokensForPerson(person);
    if (!tokens.length) continue;
    const titleLead = task.kind === "meeting"
      ? `${task.addedBy} added a meeting`
      : `${task.addedBy} added a task for you`;
    await sendTo(
      tokens,
      {
        notification: {
          title: titleLead,
          body: trim(task.text || ""),
        },
        data: { tag: `tasks-${event.params.taskId}`, url: "/" },
      },
      docs
    );
  }
});

// task reassignment — swap-person or handoff to next step
exports.onTaskUpdated = onDocumentUpdated("tasks/{taskId}", async (event) => {
  const before = event.data && event.data.before && event.data.before.data();
  const after = event.data && event.data.after && event.data.after.data();
  if (!before || !after) return;

  // if the time or due date changed, clear the "already notified" mark
  // so the due-time alarm can fire again at the new time
  if (
    after.dueNotifiedAt &&
    (before.time !== after.time || before.dueDate !== after.dueDate)
  ) {
    try {
      await event.data.after.ref.update({ dueNotifiedAt: FieldValue.delete() });
    } catch (err) {
      logger.warn("couldn't clear dueNotifiedAt:", err);
    }
  }

  if (after.parentId) return; // sub-task — covered by its parent's notification
  if (after.kind === "meeting") return;
  if (!after.person) return;
  if (before.person === after.person) return;

  const isHandoff = (after.sequenceStep || 0) > (before.sequenceStep || 0);
  const { tokens, docs } = await tokensForPerson(after.person);
  if (!tokens.length) return;

  const stepText = isHandoff && Array.isArray(after.sequence)
    ? (after.sequence[after.sequenceStep] && after.sequence[after.sequenceStep].text) || ""
    : "";

  await sendTo(
    tokens,
    {
      notification: {
        title: isHandoff
          ? `your turn: ${trim(after.text || "task", 50)}`
          : `task moved to you`,
        body: isHandoff
          ? (stepText ? trim(stepText) : "previous step is done — you're up")
          : trim(after.text || ""),
      },
      data: { tag: `task-update-${event.params.taskId}`, url: "/" },
    },
    docs
  );
});

// debugging — when client writes to test_pings collection, send a test push
// immediately to that person's tokens. Lets the user verify notifications
// are actually arriving on a given device.
exports.handleTestPing = onDocumentCreated("test_pings/{id}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data() || {};
  const person = data.person;
  if (!person) return;

  const { tokens, docs } = await tokensForPerson(person);
  if (!tokens.length) {
    logger.info(`test ping requested for ${person}, but no tokens`);
    try { await snap.ref.delete(); } catch {}
    return;
  }

  await sendTo(
    tokens,
    {
      notification: {
        title: "test ping",
        body: `if you see this, notifications work on this device (${person}).`,
      },
      data: { tag: "test-ping", url: "/" },
    },
    docs
  );

  try { await snap.ref.delete(); } catch {}
});

// fires every minute — sends a notification when a task's scheduled time matches now
exports.notifyDueTasks = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
    timeoutSeconds: 60,
    timeZone: "America/Chicago",
  },
  async () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    const currentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    const snap = await getFirestore()
      .collection("tasks")
      .where("dueDate", ">=", todayStart)
      .where("dueDate", "<", todayEnd)
      .get();

    let count = 0;
    for (const taskDoc of snap.docs) {
      const task = taskDoc.data();
      if (task.parentId) continue; // sub-task — handled with its parent
      if (!task.time || task.time !== currentTime) continue;
      if (task.done) continue;
      if (task.dueNotifiedAt) continue; // already notified

      // who gets pinged
      let recipients = [];
      if (task.kind === "meeting" && task.person === "both") {
        recipients = ["oliver", "josh"];
      } else if (task.person && task.person !== "both") {
        recipients = [task.person];
      }
      if (!recipients.length) continue;

      for (const person of recipients) {
        const { tokens, docs: tokenDocs } = await tokensForPerson(person);
        if (!tokens.length) continue;
        const titleLead = task.kind === "meeting"
          ? `meeting now: ${trim(task.text || "", 50)}`
          : `due now: ${trim(task.text || "", 50)}`;
        const body = task.kind === "meeting" && task.location
          ? `@ ${task.location}`
          : (task.text ? trim(task.text) : "");
        await sendTo(
          tokens,
          {
            notification: { title: titleLead, body },
            data: { tag: `due-${taskDoc.id}`, url: "/" },
          },
          tokenDocs
        );
      }

      try {
        await taskDoc.ref.update({ dueNotifiedAt: Date.now() });
      } catch (err) {
        logger.warn("couldn't mark dueNotifiedAt:", err);
      }
      count++;
    }
    if (count > 0) logger.info(`fired ${count} due-time notifications`);
  }
);
