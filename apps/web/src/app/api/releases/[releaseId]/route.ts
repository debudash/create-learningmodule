import { releaseExport } from '@lcg/db';
import { toNewselaLesson } from '@lcg/newsela-format';
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { currentUser } from '@/server/session';

/**
 * A Unit Release as JSON: the stable read endpoint for importing into Newsela's
 * product. `?format=newsela` converts each Lesson to the shape of Newsela's
 * published lesson objects (a demonstration on the common blocks).
 */
export async function GET(request: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const release = await releaseExport(db, (await params).releaseId);
  if (!release) return NextResponse.json({ error: 'No such Release' }, { status: 404 });

  const newsela = new URL(request.url).searchParams.get('format') === 'newsela';
  const body = newsela
    ? {
        ...release,
        lessons: release.lessons.map((entry) => ({
          key: entry.key,
          ...toNewselaLesson(entry.lesson, {
            ...(entry.lessonNumber !== null ? { lessonNumber: entry.lessonNumber } : {}),
            unitTitle: release.unit.title,
          }),
        })),
      }
    : release;
  const filename = `g${release.unit.grade}-u${release.unit.unitNumber}-release-${release.release.number}${newsela ? '-newsela' : ''}.json`;
  return NextResponse.json(body, { headers: { 'content-disposition': `attachment; filename="${filename}"` } });
}
