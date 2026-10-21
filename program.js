/**
 * DryDay — Program Content & Curriculum Data (Phase 3 & 4)
 * Based on NICE, NHS Squeezy, AUA/SUFU, ACOG, Mayo Clinic, and APTA guidelines.
 */

const PROGRAM = {
  weeks: [
    {
      weekNumber: 1,
      title: "Foundation & Control",
      subtitle: "Days 1 to 7: Building muscle awareness, safe holds, and urge control.",
      days: [
        {
          day: 1,
          title: "Learn Your Pelvic Floor",
          duration: "~5 min",
          summary: "Find the right muscles gently, avoid the 4 common mistakes, and learn why we never practice by stopping urine midstream.",
          lessonHtml: `
            <h4>Finding Your Pelvic Floor Muscles</h4>
            <p>Imagine you are trying to stop passing gas and simultaneously stopping the flow of urine. The muscles that lift inward and upward are your pelvic floor.</p>
            <h4>The 4 Common Mistakes to Avoid</h4>
            <ul>
              <li><strong>Holding your breath:</strong> Always breathe normally or count out loud during squeezes.</li>
              <li><strong>Squeezing outer muscles:</strong> Keep your buttocks, thighs, and abdomen completely relaxed.</li>
              <li><strong>Pushing downward:</strong> Never bear down or push; always lift <em>upward</em>.</li>
              <li><strong>Stopping midstream:</strong> Never practice by stopping your urine flow in the bathroom, as this can lead to incomplete emptying and infections (Mayo Clinic / NICE guideline).</li>
            </ul>
          `,
          session: {
            type: "slow",
            reps: 6,
            holdSeconds: 3,
            relaxSeconds: 6,
            instructions: "Gentle exploration: Squeeze and lift upward for 3 seconds, then relax completely for 6 seconds."
          },
          habit: "Start your Bladder Diary today by logging your bathroom trips, drinks, and any urges."
        },
        {
          day: 2,
          title: "Slow Holds for Base Strength",
          duration: "~5 min",
          summary: "Focus on slow-twitch fibers that support your bladder throughout the day, emphasizing complete relaxation between reps.",
          lessonHtml: `
            <h4>Why Slow Holds Matter</h4>
            <p>Slow-twitch muscle fibers provide continuous, endurance support to keep your bladder secure when you walk, stand, or lift.</p>
            <p><strong>Crucial Rule:</strong> The resting phase between contractions is just as important as the squeeze. Let go completely so your muscles do not fatigue too quickly.</p>
          `,
          session: {
            type: "slow",
            reps: 8,
            holdSeconds: 4,
            relaxSeconds: 6,
            instructions: "Squeeze and lift smoothly for 4 seconds. Rest and completely soften for 6 seconds."
          },
          habit: "Breathe normally or count out loud during each contraction to prevent breath-holding."
        },
        {
          day: 3,
          title: "Quick Reflexes + Slow Holds",
          duration: "~5 min",
          summary: "Introduce fast-twitch contractions that react instantly when you cough, sneeze, or feel a sudden bladder spasm.",
          lessonHtml: `
            <h4>Fast-Twitch Firing</h4>
            <p>Fast-twitch fibers act like a safety brake. They snap shut in less than a second to block sudden pressure leaks.</p>
          `,
          session: {
            type: "mixed",
            slowReps: 8,
            slowHold: 4,
            slowRelax: 6,
            fastReps: 6,
            fastHold: 1,
            fastRelax: 2,
            instructions: "8 slow holds (4s hold / 6s relax), followed by 2 series of fast quick contractions (1s squeeze / 2s relax)."
          },
          habit: "Do 1 extra set of 5 quick contractions right after brushing your teeth today."
        },
        {
          day: 4,
          title: "Position Practice (Gravity)",
          duration: "~5 min",
          summary: "Practice pelvic floor engagement across different body positions to build real-world strength against gravity.",
          lessonHtml: `
            <h4>Training Against Gravity</h4>
            <p>It is easiest to feel these muscles while lying down. As you progress, practicing while sitting and standing ensures your pelvic floor protects you in daily life.</p>
          `,
          session: {
            type: "positions",
            blocks: [
              { name: "Lying Down", reps: 5, hold: 4, relax: 6 },
              { name: "Sitting Upright", reps: 5, hold: 4, relax: 6 },
              { name: "Standing", reps: 5, hold: 4, relax: 6 }
            ],
            instructions: "Complete 5 slow holds in each position: lying, sitting, and standing."
          },
          habit: "Try 3 gentle contractions while standing and waiting for your coffee or tea to brew."
        },
        {
          day: 5,
          title: "The Knack (Cough & Sneeze Shield)",
          duration: "~5 min",
          summary: "Master 'The Knack': the proven clinical reflex of contracting 1 second before and during a cough, sneeze, or lift.",
          lessonHtml: `
            <h4>What is The Knack?</h4>
            <p>Endorsed by physical therapy guidelines (APTA), 'The Knack' is timing your muscle squeeze just <strong>before</strong> intra-abdominal pressure spikes from coughing, laughing, or lifting.</p>
          `,
          session: {
            type: "knack",
            slowReps: 8,
            knackReps: 6,
            instructions: "8 slow foundational holds, followed by 6 simulated 'Knack' practice squeezes (squeeze firm for 2s, relax for 4s)."
          },
          habit: "Use 'The Knack' reflex every time you feel a cough, sneeze, or when getting up from a deep chair today."
        },
        {
          day: 6,
          title: "Urge Control & Bladder Training",
          duration: "~5 min",
          summary: "Learn how rushing to the bathroom worsens leaks. Discover the 'Stop, Sit, Breathe & Distract' 60-second urge suppression routine.",
          lessonHtml: `
            <h4>Calming Sudden Urges</h4>
            <p>Rushing to the toilet when you feel a sudden surge sends panic signals to your bladder. Instead: stop in your tracks, sit down if possible, do quick gentle squeezes, and take slow abdominal breaths.</p>
          `,
          session: {
            type: "urge_sos",
            instructions: "8 slow holds + 1 guided 60-second Urge Suppression routine (5 quick contractions + slow belly breathing)."
          },
          habit: "Avoid 'just in case' bathroom trips when you don't feel a true, full urge."
        },
        {
          day: 7,
          title: "Week 1 Review & Check-in",
          duration: "~5 min",
          summary: "Celebrate completing Week 1! Compare your diary baseline and see how your coordination and confidence are growing.",
          lessonHtml: `
            <h4>Your First Week Milestone</h4>
            <p>Clinical studies (NICE) show muscle strengthening takes 6 to 12 weeks, but improved neuromuscular coordination and urge control begin building immediately.</p>
          `,
          session: {
            type: "full_review",
            instructions: "Full Week 1 routine: 8 slow holds + 8 quick contractions + 3 Knack practice reps."
          },
          habit: "Check the Progress tab to compare your Day 1 logs with today."
        }
      ]
    }
  ]
};
