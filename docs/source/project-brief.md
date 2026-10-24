# Project Brief

> Source document, stored as received. Wording, typos and links are kept exactly as
> given; only Markdown headings and list formatting were added.

**Lesson Content Generation and Editing/Approval Workflow**
Newsela

- Tier: Silver
- Version: 1
- Role: Principal Product Engineer/Member of Technical Staff
- Last updated: 10/19/2026

## PRD

Newsela is entering a new market this year, "Core" Instruction for California. This means creating programs of 40 weeks of instruction that are adopted by the State/District for all teachers to follow (as opposed to single-lesson-oriented teacher tools and AI planners). The 40 weeks of instruction are broken into 4 sequential units of ~40 lessons each. To do this, we'll need to build an AI tool to generate the lessons in bulk, review, edit and approve them  by our staff --  versus prohibitively enormous manual authoring work required to do so in the past.

## Problem & Context

### Business Context

Newsela has long been the "go-to" tool for K-12 Teachers to grab grade-leveled, tailored lesson and article content for including in their lessons (along with additional tools and AI capabilities for assessment and district analytics). We have been exploring the idea of entering the "Core" curriculum market for a few years, since its a huge opportunity (that plots us against slow-moving/less innovative "textbook" incumbents like McGraw Hill/Pearson). However, entry into that requires generating huge programs of lesson content for an entire year of daily instruction as well as a rigorous state approval process. But the market opportunity is huge, and with AI to help, this is the year we're entering it.

Our content creators (an army of freelancers who write lessons) would have traditionally written the lessons by hand, which is slow and requires enormous coordination and inordinate timelines and fighting quality issues, and results in us getting tons of lesson documents we need to review/revise and then import into our system. The goal here would be to supplant the manual lesson writing step, generating the lessons with AI based on CA standards -- creating a overall workflow system and UI that allows for the generation of those lessons based on an uploaded instructional outline using an agent/LLM, import them into a system for persistence, and has an interface for our review staff to review, edit/update (via direct wysiwyg editing and even AI tools as needed), and then mark the content as approve/finalized. This will remove the barriers to entry to market and unlock our ability to sell full programs to users who already love us.

### Impact Metrics

ARR (annual recurring revenue) -  10's of millions market for us.

## Requirements & Success Criteria

### Functional Requirements

- AI Generate lessons for an entire Unit of instruction using a uploaded/imported lesson outline for a unit. That outline is a google spreadsheet of ~40 lessons indicating what each lesson should cover and the learning arc, (see example via google link in the bullet below).
- Each lesson represents about ~50 mins of classroom instruction, and is aligned to teach the CA Core ELA/ELD standards numbers indicated in the sheet (e.g., RI.6.4, --  standards and definitions can be found online), referencing text/novel indicated in the provided unit outline sheet. The lesson format and structure (e.g., what sections and how to break down a lesson) is available at the 'Example of lesson and format/structure' link in the bullet below.
- Have a UI/UX for content experts to upload the spreadsheet/link for a Unit and start the generation process; bonus points if you allow the editing of the prompt so content authors can tweak the output and let them view the generation in process.
- Import the generated lesson content into a system for persistence and tracking, so that next steps of editing, approval, finalization can take place, and ultimately published to our application.
- Have a UI/UX for reviewing and editing/updating a lesson's content in the system (wysiwyg), and AI assisted tooling as helpful.
- Have a UI/UX for approval workflow for lessons within a unit, where once reviewed/updated it is flagged as complete in our system.
- Sample Unit Outline sheet for lessons to be generated from (this is the instrucitonal design our experts create prior to the AI generating): https://docs.google.com/spreadsheets/d/1OfigF5jtwagY8jJMk5g536tAgykkIR6xHGa0Bic_QnE/edit?usp=sharing
- Example of individual lesson and format and structure here (feel free to navigate to other examples too): https://ca-2026-review.newsela.com/course/cmkfw4elj004k8a90yvyfyfb8/unit/ck73kftqkdhaojqgqft3acmy/lesson/c0c4tx7u3mnezs5w9u8vzvi1
- Please use the example(s) from the lesson format/structure link above to identify the sections and structure of the lessons, these are legitimate lessons already created. It will show the front matter we include with each lesson header and then the sections within the lesson that the teacher should follow (Launch, Learning In Action, Look Back, etc). It is ok if the generated lesson content is stored as content separate of the visual template you see at the link directly above; what's important is that we generate standard aligned content to fill out the lesson. Since you may not be familiar with the specific activities to fill out each lesson sequence step, its OK to improvise what content goes in there based on the examples (feel free to crawl as many examples as needed via that link to examine content and build AI instructions to generate).

### Performance Benchmarks

- Generation of lessons can happen asynchronously, since it works off a lesson outline sheet is created by an instructional expert and uploaded into the tool, so a few minutes per lesson is ok -- doesn't have to be realtime.
- Rest of workflow and loading/editing of lessons should be performant and be able to handle staff of 20+ reviewers

### Code Quality Expectations

Clean, well structured architecture.

### Time Constraints

1-2 days

### Technical Contact

andrew.parker@newsela.com

## Technology

### Required Languages

Javascript (Next/Node), React, and Python (if desired)

### AI / ML Frameworks

OpenAI or Anthropic APIs

### Dev Tools

Any (your choice of coding agents and IDE, we typically use Claude Code and Codex)

### Cloud Platforms

Any (we use AWS, but if any lighter-weight hosting platform, e.g. Vercel or Railway, works then feel free)

### Other Requirements

ProseMirror and Yjs for the frontend/collaborative editor

### Off-Limits Tech

Thoughtful design and easy to understand/use/navigate workflow; creativity and resourcefulness to work with creating a solution for improving productivity of internal staff. Please see details in description fields for links to reference material and sample data, and note that many description sections have multiple paragraphs so please scroll to end of each to read through. Please reach out to andrew.parker@newsela.com if any questions or clarifications needed, or if difficulty accessing resource links above.

## Submission & AI Policy

### AI Usage Documentation

Optional

### Required Deliverables

- Source Code
- Technical Documentation
