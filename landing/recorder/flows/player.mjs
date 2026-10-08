// The landing film: play the sample book, jump ahead, boost the volume, pick a chapter, switch to
// car mode, then return to the library and find every earlier position again in History.
export const title = 'EVB Folder Player';

/** Adds the bundled sample and opens it, as a first-time visitor of the preview would. Not filmed. */
export async function prepare(page) {
  await page.getByRole('button', { name: 'Try sample' }).click();
  await page.getByRole('button', { name: 'Open A Quieter Chapter' }).click();
  await page.getByRole('button', { name: 'Play' }).waitFor();
}

export default async function flow(page, rec) {
  const settle = (ms = 700) => page.waitForTimeout(ms);
  /** Holds on the current state, taps the target at the end of the step, then performs the tap. */
  const tap = async (locator, dur = 18) => {
    await rec.snap({ dur, cursor: await rec.center(locator), click: true });
    await locator.first().click();
  };

  // The first state is the poster: the book's cover, ready to play. A mouse pointer (desktop films)
  // rests beside the play button; the phone film shows only taps.
  await settle();
  const [playX, playY] = await rec.center(page.getByRole('button', { name: 'Play' }));
  await rec.snap({ dur: 40, cursor: [playX + 90, playY + 60] });
  await tap(page.getByRole('button', { name: 'Play' }));
  await page.getByRole('button', { name: 'Pause' }).waitFor();
  await settle(1500);
  await rec.snap({ dur: 30 });
  await tap(page.getByRole('button', { name: 'Forward 20 seconds' }));
  await settle(900);
  await rec.snap({ dur: 30 });
  await tap(page.getByRole('button', { name: 'Volume boost' }));
  await settle(400);
  await rec.snap({ dur: 24 });
  await tap(page.getByRole('button', { name: '+6 dB' }));
  await settle(400);
  await rec.snap({ dur: 30 });

  await tap(page.getByRole('button', { name: 'Chapters', exact: true }));
  await settle();
  await rec.snap({ dur: 32, transition: 'fade', fade: 8 });
  await tap(page.getByRole('button', { name: 'Chapter 2: A quieter chapter' }));
  await settle(1500);
  await rec.snap({ dur: 34 });

  await tap(page.getByRole('button', { name: 'Car mode' }));
  await settle();
  await rec.snap({ dur: 44, transition: 'fade', fade: 8 });
  await tap(page.getByRole('button', { name: 'Exit car mode' }));
  await settle();
  await rec.snap({ dur: 24, transition: 'fade', fade: 8 });

  // The library keeps the book's place; History keeps every earlier one.
  await tap(page.getByRole('button', { name: 'Library' }));
  await settle();
  await rec.snap({ dur: 40, transition: 'fade', fade: 8 });
  await tap(page.getByRole('button', { name: 'History', exact: true }));
  await page.getByText('Before jump').first().waitFor();
  await settle();
  await rec.snap({ dur: 80, transition: 'fade', fade: 8 });
}
