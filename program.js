/**
 * DryDay — Complete Curriculum Data (Phase 4)
 * Architecture for Weeks 1–8 (Week 1 fully populated from CONTENT_SOURCES.md).
 * Plain, warm, encouraging English (6th–8th grade reading level).
 */

const PROGRAM = {
  patternAdjustments: {
    stress: {
      label: "Stress Pattern Focus",
      summaryNote: "Extra emphasis on muscle strength and 'The Knack' (squeezing before a cough, sneeze, laugh, or lift).",
      bonusBlock: {
        name: "Stress Shield Bonus ('The Knack')",
        position: "Sitting or Standing",
        cue: "Pretend you are about to sneeze. Squeeze and lift firmly for 2 seconds, then relax completely for 4 seconds.",
        reps: 3,
        holdSeconds: 2,
        relaxSeconds: 4
      }
    },
    urge: {
      label: "Urge Pattern Focus",
      summaryNote: "Extra emphasis on calming bladder spasms with quick flicks, slow belly breathing, and spacing out bathroom trips.",
      bonusBlock: {
        name: "Urge Calming Bonus",
        position: "Sitting Comfortably",
        cue: "Quick, gentle pelvic floor flicks to send a 'calm down' signal to your bladder muscle.",
        reps: 5,
        holdSeconds: 1,
        relaxSeconds: 2
      }
    },
    mixed: {
      label: "Mixed Pattern Focus",
      summaryNote: "A balanced combination of endurance holds, quick 'Knack' reflexes, and urge-calming techniques.",
      bonusBlock: {
        name: "Balanced Protection Bonus",
        position: "Sitting Upright",
        cue: "Firm 2-second squeeze for cough protection followed by a deep, full 4-second release.",
        reps: 3,
        holdSeconds: 2,
        relaxSeconds: 4
      }
    }
  },

  weeks: [
    {
      weekNumber: 1,
      title: "Week 1: Foundation & Awareness",
      status: "unlocked",
      description: "Learn to find the right muscles safely, build gentle beginner holds, practice 'The Knack', and calm sudden urges.",
      days: [
        {
          day: 1,
          title: "Learn Your Pelvic Floor",
          duration: "~5 min",
          summary: "Find the right muscles gently, avoid the 4 common mistakes, and learn why we never practice by stopping urine midstream.",
          lessonHtml: `
            <h4>How to Find the Right Muscles</h4>
            <p>Sit or lie down comfortably with your knees slightly apart. Imagine you are trying to stop passing gas at the back, and at the same time trying to stop the flow of urine at the front. The gentle feeling of <strong>"squeeze and lift"</strong> inside is your pelvic floor.</p>
            <h4>4 Common Mistakes to Avoid</h4>
            <ul>
              <li><strong>Holding your breath:</strong> Breathe naturally or count out loud during every squeeze.</li>
              <li><strong>Squeezing outside muscles:</strong> Keep your buttocks, thighs, and belly soft and still.</li>
              <li><strong>Pushing down:</strong> Never bear down like having a bowel movement—always lift <em>upward and inward</em>.</li>
              <li><strong>Stopping urine midstream:</strong> Never do your exercises while sitting on the toilet passing urine. Clinical guidelines (NICE &amp; Mayo Clinic) warn this can keep your bladder from emptying fully and increase infection risk.</li>
            </ul>
          `,
          habit: "Start your Bladder Diary today: tap the Progress tab to log your bathroom trips, drinks, and any urges or leaks.",
          blocks: [
            {
              name: "Gentle Muscle Discovery (Set 1)",
              position: "Lying Down or Sitting",
              cue: "Gently squeeze and lift inward for 3 seconds, then let go completely for 6 seconds.",
              reps: 6,
              holdSeconds: 3,
              relaxSeconds: 6
            },
            {
              name: "Rest & Breathe",
              position: "Relaxed",
              cue: "Let your belly and pelvic floor stay completely soft while you breathe slowly.",
              isRest: true,
              restSeconds: 15
            },
            {
              name: "Gentle Muscle Discovery (Set 2)",
              position: "Lying Down or Sitting",
              cue: "Focus on a clean release after every 3-second lift. Keep your thighs and buttocks relaxed.",
              reps: 6,
              holdSeconds: 3,
              relaxSeconds: 6
            }
          ]
        },
        {
          day: 2,
          title: "Slow Holds for Strength",
          duration: "~5 min",
          summary: "Build gentle endurance with 4-second slow holds and learn why relaxing completely between squeezes is just as important.",
          lessonHtml: `
            <h4>Why Slow Holds Build Support</h4>
            <p>Your pelvic floor has slow-working muscle fibers that gently hold up your bladder all day long. Holding a gentle contraction for a few seconds trains these supportive fibers.</p>
            <h4>Why Full Relaxation Matters</h4>
            <p>A muscle that stays tight gets tired and weak. Letting go completely for <strong>6 full seconds</strong> between squeezes gives your muscles fresh blood flow and teaches you true control.</p>
          `,
          habit: "Count out loud ('one, two, three, four') during your squeezes today so you never hold your breath.",
          blocks: [
            {
              name: "Slow Strength Holds (Set 1)",
              position: "Lying Down or Sitting",
              cue: "Squeeze and lift smoothly for 4 seconds. Soften and release completely for 6 seconds.",
              reps: 8,
              holdSeconds: 4,
              relaxSeconds: 6
            },
            {
              name: "Mid-Session Rest",
              position: "Relaxed",
              cue: "Take slow, easy breaths. Notice how a fully relaxed pelvic floor feels.",
              isRest: true,
              restSeconds: 20
            },
            {
              name: "Slow Strength Holds (Set 2)",
              position: "Lying Down or Sitting",
              cue: "Keep your shoulders, jaw, and belly relaxed while your pelvic floor does the work.",
              reps: 8,
              holdSeconds: 4,
              relaxSeconds: 6
            }
          ]
        },
        {
          day: 3,
          title: "Quick Contractions + Slow Holds",
          duration: "~5 min",
          summary: "Wake up your fast-reacting muscle fibers with 1-second quick squeezes alongside your steady slow holds.",
          lessonHtml: `
            <h4>Two Types of Muscle Fibers</h4>
            <p>Yesterday you trained your slow endurance fibers. Today we add <strong>quick contractions</strong> (also called "quick flicks").</p>
            <p>These fast fibers act like a quick safety reflex. They help close the urethra in a split second when you laugh, cough, or feel a sudden bladder wave.</p>
          `,
          habit: "Do 5 quick 1-second squeezes right after you brush your teeth tonight.",
          blocks: [
            {
              name: "Steady Slow Holds",
              position: "Sitting Comfortably",
              cue: "Squeeze and lift for 4 seconds, then relax completely for 6 seconds.",
              reps: 8,
              holdSeconds: 4,
              relaxSeconds: 6
            },
            {
              name: "Rest Break",
              position: "Relaxed",
              cue: "Breathe gently and let go of any tension.",
              isRest: true,
              restSeconds: 15
            },
            {
              name: "Quick Reflex Squeezes (Set 1)",
              position: "Sitting Comfortably",
              cue: "Lift firmly for 1 second, then drop and relax completely for 2 seconds.",
              reps: 6,
              holdSeconds: 1,
              relaxSeconds: 2
            },
            {
              name: "Rest Break",
              position: "Relaxed",
              cue: "Take two slow breaths before the second quick set.",
              isRest: true,
              restSeconds: 12
            },
            {
              name: "Quick Reflex Squeezes (Set 2)",
              position: "Sitting Comfortably",
              cue: "Quick 1-second lift, full 2-second release.",
              reps: 6,
              holdSeconds: 1,
              relaxSeconds: 2
            }
          ]
        },
        {
          day: 4,
          title: "Practice in Different Positions",
          duration: "~5 min",
          summary: "Train your muscles lying down, sitting upright, and standing up so they support you during real daily activities.",
          lessonHtml: `
            <h4>Moving Against Gravity</h4>
            <p>When you lie down, gravity isn't pulling on your bladder, making it the easiest way to feel your muscles. When you sit and stand, your pelvic floor works gently against gravity.</p>
            <p>Practicing in all three positions bridges the gap between exercise time and everyday life.</p>
          `,
          habit: "Do 3 gentle standing squeezes today while waiting for the kettle, microwave, or coffee maker.",
          blocks: [
            {
              name: "Position 1: Lying Down",
              position: "Lying Down",
              cue: "Notice how clearly you can feel the inward lift and full release.",
              reps: 5,
              holdSeconds: 4,
              relaxSeconds: 6
            },
            {
              name: "Change Position: Sit Upright",
              position: "Transition",
              cue: "Slowly sit up in a chair or on the edge of the bed with feet flat on the floor.",
              isRest: true,
              restSeconds: 15
            },
            {
              name: "Position 2: Sitting Upright",
              position: "Sitting Upright",
              cue: "Lift up away from the chair seat for 4 seconds, then relax for 6 seconds.",
              reps: 5,
              holdSeconds: 4,
              relaxSeconds: 6
            },
            {
              name: "Change Position: Stand Up",
              position: "Transition",
              cue: "Stand comfortably with your feet hip-width apart and shoulders relaxed.",
              isRest: true,
              restSeconds: 15
            },
            {
              name: "Position 3: Standing Strong",
              position: "Standing",
              cue: "Squeeze and lift against gravity for 4 seconds, then soften for 6 seconds.",
              reps: 5,
              holdSeconds: 4,
              relaxSeconds: 6
            }
          ]
        },
        {
          day: 5,
          title: "'The Knack': Cough & Sneeze Shield",
          duration: "~5 min",
          summary: "Learn 'The Knack'—a simple, proven timing skill: squeeze just before and during a cough, sneeze, laugh, or lift.",
          lessonHtml: `
            <h4>What Is 'The Knack'?</h4>
            <p>Physical therapists teach a powerful habit called <strong>"The Knack."</strong> Whenever you cough, sneeze, laugh, blow your nose, or lift a heavy bag, pressure pushes down on your bladder.</p>
            <p>By squeezing and lifting your pelvic floor <strong>1 second before</strong> the cough or lift—and holding until it finishes—you give your urethra instant extra support.</p>
          `,
          habit: "Use 'The Knack' today before every cough, sneeze, laugh, or when standing up from a low chair.",
          blocks: [
            {
              name: "Warm-Up Slow Holds",
              position: "Sitting or Standing",
              cue: "Steady 4-second squeeze and lift, followed by a 6-second full release.",
              reps: 8,
              holdSeconds: 4,
              relaxSeconds: 6
            },
            {
              name: "Rest Break",
              position: "Relaxed",
              cue: "Relax and prepare to practice 'The Knack' timing.",
              isRest: true,
              restSeconds: 15
            },
            {
              name: "Practice 'The Knack'",
              position: "Standing or Sitting",
              cue: "Imagine you are about to cough: squeeze firmly for 2 seconds, then relax completely for 4 seconds.",
              reps: 6,
              holdSeconds: 2,
              relaxSeconds: 4
            }
          ]
        },
        {
          day: 6,
          title: "Urge Control & Bladder Training",
          duration: "~5 min",
          summary: "Learn why rushing to the bathroom triggers stronger spasms, and practice the 60-second urge-calming method.",
          lessonHtml: `
            <h4>Why We Don't Rush to the Bathroom</h4>
            <p>When a sudden urge hits, rushing to the toilet increases stress and jiggles the bladder, making leaks much more likely. Instead, pelvic health guidelines recommend <strong>Urge Suppression</strong>:</p>
            <ul>
              <li><strong>Stop and stand still</strong> (or sit down firmly if a chair is nearby).</li>
              <li><strong>Do 5 quick pelvic floor squeezes</strong> to tell your bladder muscle to relax.</li>
              <li><strong>Breathe slowly into your belly</strong> and distract your mind (count backward from 100 by 7s).</li>
              <li><strong>Walk calmly</strong> to the bathroom only after the wave fades.</li>
            </ul>
            <h4>Skipping 'Just in Case' Trips</h4>
            <p>Going to the toilet every 30–60 minutes "just in case" trains your bladder to hold less. Gently waiting 5–10 extra minutes when your bladder isn't truly full helps rebuild healthy capacity.</p>
          `,
          habit: "Skip one 'just in case' bathroom trip today when you know you went less than an hour ago.",
          blocks: [
            {
              name: "Calm Foundation Holds",
              position: "Sitting Comfortably",
              cue: "Smooth 4-second squeeze and lift, 6-second complete release.",
              reps: 8,
              holdSeconds: 4,
              relaxSeconds: 6
            },
            {
              name: "Urge Wave Simulation: Quick Flicks",
              position: "Sitting Comfortably",
              cue: "Imagine a sudden urge just arrived. Stay still and do 5 quick 1-second squeezes.",
              reps: 5,
              holdSeconds: 1,
              relaxSeconds: 2
            },
            {
              name: "Calming Belly Breaths",
              position: "Sitting Comfortably",
              isBreathing: true,
              cue: "Inhale gently for 4 seconds, exhale slowly for 6 seconds while letting the urge wave pass.",
              reps: 4,
              holdSeconds: 4,
              relaxSeconds: 6
            }
          ]
        },
        {
          day: 7,
          title: "Week 1 Review & Check-In",
          duration: "~5 min",
          summary: "Put all your Week 1 skills together in one complete session and compare your Bladder Diary with Day 1.",
          lessonHtml: `
            <h4>Celebrating Your First Week</h4>
            <p>You made it to Day 7! Clinical guidelines (NICE &amp; Cochrane reviews) show that building full muscle thickness takes several weeks of steady practice—just like any other muscle in the body.</p>
            <p>However, many women notice better awareness, fewer rushed trips, and stronger confidence with <em>The Knack</em> and <em>Urge SOS</em> right from the first week.</p>
          `,
          habit: "Open the Progress tab after this session to review your Week 1 streak and compare Days 1–2 with Days 6–7.",
          blocks: [
            {
              name: "Part 1: Slow Strength Holds",
              position: "Sitting or Standing",
              cue: "Squeeze and lift for 4 seconds, relax completely for 6 seconds.",
              reps: 8,
              holdSeconds: 4,
              relaxSeconds: 6
            },
            {
              name: "Rest Break",
              position: "Relaxed",
              cue: "Take a slow breath and relax your shoulders.",
              isRest: true,
              restSeconds: 15
            },
            {
              name: "Part 2: Quick Reflex Squeezes",
              position: "Sitting or Standing",
              cue: "Firm 1-second lift, complete 2-second release.",
              reps: 8,
              holdSeconds: 1,
              relaxSeconds: 2
            },
            {
              name: "Part 3: 'The Knack' Check",
              position: "Standing",
              cue: "Squeeze firmly for 2 seconds as if bracing for a cough or laugh, then relax for 4 seconds.",
              reps: 3,
              holdSeconds: 2,
              relaxSeconds: 4
            }
          ]
        }
      ]
    },
    // Architecture ready for Weeks 2–8 expansion
    { weekNumber: 2, title: "Week 2: Building 5-Second Endurance", status: "locked", description: "Gradually extend slow holds to 5 seconds and practice sitting-to-standing transitions.", days: [] },
    { weekNumber: 3, title: "Week 3: Standing Control & Bladder Intervals", status: "locked", description: "More standing sets and gentle 10-minute bladder interval extensions.", days: [] },
    { weekNumber: 4, title: "Week 4: Mid-Program Strength (6-Second Holds)", status: "locked", description: "Progress toward 6-second holds with full relaxation and real-life movement.", days: [] },
    { weekNumber: 5, title: "Week 5: Dynamic Movement & Lifting Support", status: "locked", description: "Coordinate pelvic floor support with walking, stairs, and household lifting.", days: [] },
    { weekNumber: 6, title: "Week 6: 8-Second Endurance & Calm Habits", status: "locked", description: "Build toward 8-second holds for those who feel ready, plus fluid timing habits.", days: [] },
    { weekNumber: 7, title: "Week 7: Confidence in Daily Situations", status: "locked", description: "Out-and-about strategies, travel confidence, and advanced reflex timing.", days: [] },
    { weekNumber: 8, title: "Week 8: Lifelong Maintenance Routine", status: "locked", description: "Your sustainable long-term routine to keep your pelvic floor strong.", days: [] }
  ]
};
