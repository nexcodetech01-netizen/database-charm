# Visual Refactor for Chat Bubbles (UI/UX)

Reformulate the chat message bubbles in the WhatsApp console to follow the enterprise design language, supporting bold formatting (WhatsApp style) and improving layout/spacing.

## Proposed Changes

### UI/UX Updates

- **Message Bubble Dimensions**:
    - Limit max width to `70%` (`max-w-[70%]`).
    - Aligned correctly (Inbound: Left, Outbound: Right).
- **Bubble Styling**:
    - **Inbound (Customer)**: `bg-slate-800 text-slate-100 rounded-2xl rounded-tl-sm p-3 shadow-sm mr-auto`.
    - **Outbound (Operator/Bella)**: `bg-blue-600 text-white rounded-2xl rounded-tr-sm p-3 shadow-sm ml-auto`.
- **Formatting (WhatsApp Bold)**:
    - Integrate `react-markdown` with a custom pre-processor to convert `*text*` to markdown bold `**text**` so it renders correctly.
- **System Events/Skills**:
    - Style "Skill executada: ..." as a discrete, small badge (`opacity-40 text-xs`) to reduce visual noise.
- **Timestamps**:
    - Positioned at the bottom-right *inside* the bubble.
    - Reduced font size (`text-[10px] text-slate-300`).

## Technical Details

- **Files to Modify**:
    - `src/features/whatsapp/console/ConversationTimeline.tsx`: Update JSX and styles for messages and events.
- **Dependencies**:
    - Add `react-markdown` and `remark-gfm` (already triggered installation).
- **Refinement**:
    - Ensure `whitespace-pre-wrap` is preserved within the markdown container.
    - Handle absolute positioning for timestamps inside the flex bubbles.
