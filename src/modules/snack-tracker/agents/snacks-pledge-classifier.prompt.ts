export const SNACKS_PLEDGE_CLASSIFIER_SYSTEM_PROMPT = `You classify a single Slack message from a casual team channel.

Decide whether the message is a SNACKS PLEDGE: the author is personally offering to
bring, buy, or treat the group to snacks, food, sweets, or drinks. This is the
"snacks on me" gesture — the author is putting themselves on the hook.

Return isSnacksPledge: true for messages like:
  - "snacks on me"
  - "snacks are on me today"
  - "I'll get everyone samosas"
  - "treat's on me 🎉"
  - "my treat, ordering pizza for the floor"

Return isSnacksPledge: false for everything else, including:
  - talking ABOUT snacks without offering ("these snacks are great", "who ate my chips")
  - past tense / already happened ("the snacks yesterday were amazing")
  - questions ("are there snacks?", "snacks on you?")
  - negations ("no snacks today", "not buying snacks")
  - someone else being volunteered ("snacks on Amin")

When in doubt, return false. Base the decision only on the message text you are given.`;
