# StorenTech AI — Prospect Intake Question Flow

## Overview
One-question-at-a-time conversational intake for storentechai.com prospects. Friendly, professional, fast (~2 min).

---

## Flow

### 1. WELCOME
> "Hi there! 👋 Welcome to StorenTech AI. We help businesses unlock their potential with AI-powered solutions. Let's get to know you so we can figure out how to help."
>
> **[Get Started]**

### 2. MODE_SELECT
> "Are you a new prospect or an existing client?"
>
> **[I'm New Here]** · **[Existing Client]**

*(Existing clients → OTP auth flow)*

---

### 3. IDENTITY
> "Great! Let's start with the basics."
>
> - **Full Name** (required)
> - **Work Email** (required, validated)
> - **Phone** (optional) — "In case we need to reach you quickly"

### 4. BUSINESS_CONTEXT
> "Tell us about your business."
>
> - **Company Name** (required)
> - **Industry** (optional chips): `E-commerce` · `Healthcare` · `Finance` · `Real Estate` · `Marketing` · `SaaS` · `Other`
> - **Company Size** (optional chips): `Just me` · `2-10` · `11-50` · `51-200` · `200+`

### 5. NEEDS
> "What are you looking to accomplish with AI?"
>
> - **What do you need help with?** (textarea, required)
>   - Placeholder: *"e.g., Automate customer support, build an AI chatbot, analyze data, streamline workflows..."*
>
> - **What type of solution interests you?** (chips, optional):
>   `AI Chatbot` · `Workflow Automation` · `Data Analysis` · `Custom AI App` · `AI Strategy / Consulting` · `Not Sure Yet`
>
> - **Timeline** (chips):
>   `ASAP` · `This Month` · `Next Quarter` · `Just Exploring`
>
> - **Budget Range** (chips):
>   `Under $5k` · `$5k–$15k` · `$15k–$50k` · `$50k+` · `Not Sure`

### 6. SCHEDULING (optional — can be skipped)
> "Want to book a quick intro call? It's the fastest way to get rolling."
>
> **Option A:** [Book a Time →] *(opens Calendly/booking link)*
> "Already booked? **[I Booked a Time]**"
>
> **— or —**
>
> **Option B:** Share your availability
> - **Preferred times** (textarea): *"e.g., Tue/Thu afternoons, mornings EST"*
> - **Timezone** (dropdown)
> - **Preferred contact method** (chips): `Email` · `Phone` · `Text`
>
> **[Skip This Step]**

### 7. SUMMARY
> "Here's what we've got — look good?"
>
> *(Shows summary card with all captured info)*
> *(Editable textarea for corrections/additions)*
> *(Attachment upload: PNG, JPEG, PDF)*
>
> **[Submit]**

### 8. SUBMIT
> "Thanks, [First Name]! 🎉 We've received your info and will be in touch within 1 business day. Keep an eye on your inbox."
>
> *(Optional: show social links or resource)*

---

## UX Notes
- **One question at a time** — chat bubble style, scrolling conversation
- **Quick reply chips** reduce typing friction
- **Progress indicator** shows step count + estimated time
- **"End & Send Now"** button always available as escape hatch
- **Mobile-first** — single column, large tap targets
- **Brand colors:** TBD (need StorenTech AI brand guidelines)
- **Tone:** Warm, professional, not robotic. Like talking to a helpful human.

## Existing Client Fields (for reference)
When `mode=client`:
- OTP email auth
- Project selection
- Request type: `Bug` · `Change` · `New Feature`
- Description, Impact, Urgency
- File attachments
