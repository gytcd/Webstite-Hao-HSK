// Legacy figures belong to HSK 1; newly bundled figures carry an explicit course ID.
export const figureCourse = figure => figure.courseId || 'hsk-1';
export function lessonFigures(figures,courseId,number){
 const list=figures.filter(f=>figureCourse(f)===courseId&&f.lesson===number&&!f.word);
 return [...list.filter(f=>f.primary),...list.filter(f=>!f.primary)];
}
export const primaryFigure = (figures,courseId,number) => lessonFigures(figures,courseId,number)[0]||null;
export const wordFigure = (figures,courseId,word) => figures.find(f=>figureCourse(f)===courseId&&f.word===word)||null;
