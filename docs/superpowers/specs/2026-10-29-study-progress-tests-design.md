# Study progress and diagnostic practice

Implement the user's requested study workflow in the existing Spanish React app.

- Show cards practiced, remaining cards, start dates, attempts, errors, and next review dates by section and block. A first pass is exposure, not mastery.
- Show accessible completion notices when a saved review finishes a block or section. Undo must restore the counts. Completion follows the selected plan formats in Today and all library formats in Mi avance.
- Add Mi avance with section and block selection. Let the student select exact flashcards for a subtest, select errors, select due reviews, and repeat selected questions in the same session.
- Add diagnostic exercises from Eje Clínico cases in every block. Easy mode shows the discriminator, medium hides it, and contrast mode uses free recall before reveal. Do not claim these are three distinct vignettes. Add three distinct original vignettes per diagnosis for a primary amenorrhea expansion: Turner, MRKH, complete androgen insensitivity, imperforate hymen, transverse vaginal septum, Kallmann, functional hypothalamic amenorrhea, and 46,XY gonadal dysgenesis. Link primary medical sources. Label the extension as pending clinical review.
- Store practice attempts and FSRS review dates in CoachState through the existing save hook. Do not create another browser-only store. Keep the persistence interface intact for the parallel VPS agent.
- Preserve existing content identifiers and Anki packages. Keep source audits valid. Do not delete source material or another agent's files.

Implementation choices: use original card IDs for flashcard subtests. Use stable case IDs for diagnostic exercises. Diagnostics count separately from the 2,900 library cards. A wrong answer records grade 1, a correct answer grade 3. A difficult self-rated answer is distinct from an error. Keep the existing Manrope/Lora typography and purple palette. Use a compact section list and a focused test reader on mobile.
