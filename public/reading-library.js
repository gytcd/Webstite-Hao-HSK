// Original supplementary practice. These texts are not official HSK exam papers.
export const readings = [
  {id:'greetings', title:'Một lời chào ở lớp', topic:'Chào hỏi · giới thiệu', source:'Hǎo biên soạn · Bài luyện bổ sung', sentences:[
    {h:'你好！我叫小林。',p:'Nǐ hǎo! Wǒ jiào Xiǎolín.',vi:'Xin chào! Tôi tên là Tiểu Lâm.'},
    {h:'我是学生。我学习汉语。',p:'Wǒ shì xuésheng. Wǒ xuéxí Hànyǔ.',vi:'Tôi là học sinh. Tôi học tiếng Trung.'},
    {h:'我的老师很好。',p:'Wǒ de lǎoshī hěn hǎo.',vi:'Thầy cô của tôi rất tốt.'},
    {h:'老师说：“你好！”',p:'Lǎoshī shuō: “Nǐ hǎo!”',vi:'Thầy cô nói: “Chào em!”'},
    {h:'我说：“老师，您好！”',p:'Wǒ shuō: “Lǎoshī, nín hǎo!”',vi:'Tôi nói: “Em chào thầy cô!”'}
  ]},
  {id:'family',title:'Gia đình của tôi',topic:'Gia đình · nghề nghiệp',source:'Hǎo biên soạn · Bài luyện bổ sung',sentences:[
    {h:'我家有三个人：爸爸、妈妈和我。',p:'Wǒ jiā yǒu sān ge rén: bàba, māma hé wǒ.',vi:'Nhà tôi có ba người: bố, mẹ và tôi.'},
    {h:'爸爸是医生，妈妈是老师。',p:'Bàba shì yīshēng, māma shì lǎoshī.',vi:'Bố là bác sĩ, mẹ là giáo viên.'},
    {h:'我们都喜欢喝茶。',p:'Wǒmen dōu xǐhuan hē chá.',vi:'Chúng tôi đều thích uống trà.'},
    {h:'今天，我和妈妈去学校。',p:'Jīntiān, wǒ hé māma qù xuéxiào.',vi:'Hôm nay, tôi và mẹ đến trường.'}
  ]},
  {id:'study-day',title:'Một ngày đi học',topic:'Thời gian · sinh hoạt',source:'Hǎo biên soạn · Bài luyện bổ sung',sentences:[
    {h:'现在是七点。',p:'Xiànzài shì qī diǎn.',vi:'Bây giờ là bảy giờ.'},
    {h:'我喝水，也吃饭。',p:'Wǒ hē shuǐ, yě chī fàn.',vi:'Tôi uống nước và cũng ăn cơm.'},
    {h:'八点，我去学校。',p:'Bā diǎn, wǒ qù xuéxiào.',vi:'Tám giờ, tôi đến trường.'},
    {h:'中午，我和朋友吃米饭。',p:'Zhōngwǔ, wǒ hé péngyou chī mǐfàn.',vi:'Buổi trưa, tôi và bạn ăn cơm.'},
    {h:'晚上，我在家学习汉语。',p:'Wǎnshang, wǒ zài jiā xuéxí Hànyǔ.',vi:'Buổi tối, tôi học tiếng Trung ở nhà.'}
  ]}
];
export const readingGlossary = [
  ['我','wǒ','tôi'],['叫','jiào','gọi; tên là'],['小林','Xiǎolín','Tiểu Lâm (tên riêng)'],['是','shì','là'],['学生','xuésheng','học sinh; sinh viên'],['学习','xuéxí','học tập'],['汉语','Hànyǔ','tiếng Trung'],['的','de','trợ từ biểu thị quan hệ sở hữu'],['很','hěn','rất'],['好','hǎo','tốt'],['说','shuō','nói'],['我家','wǒ jiā','nhà tôi'],['有','yǒu','có'],['三','sān','ba'],['个','ge','lượng từ thông dụng'],['人','rén','người'],['爸爸','bàba','bố'],['妈妈','māma','mẹ'],['和','hé','và; cùng'],['医生','yīshēng','bác sĩ'],['我们','wǒmen','chúng tôi; chúng ta'],['都','dōu','đều'],['喜欢','xǐhuan','thích'],['喝','hē','uống'],['茶','chá','trà'],['今天','jīntiān','hôm nay'],['去','qù','đi'],['学校','xuéxiào','trường học'],['现在','xiànzài','bây giờ'],['七','qī','bảy'],['点','diǎn','giờ (thời điểm)'],['水','shuǐ','nước'],['也','yě','cũng'],['吃饭','chī fàn','ăn cơm; dùng bữa'],['八','bā','tám'],['中午','zhōngwǔ','buổi trưa'],['朋友','péngyou','bạn bè'],['吃','chī','ăn'],['米饭','mǐfàn','cơm'],['晚上','wǎnshang','buổi tối'],['在','zài','ở'],['家','jiā','nhà'],['你好','nǐ hǎo','xin chào'],['老师','lǎoshī','giáo viên'],['您好','nín hǎo','xin chào (lịch sự)']
].map(([h,p,v]) => ({h,p,v,source:'Hǎo · chú giải bài đọc bổ sung'}));

export function courseReadings(course) {
  return (course.lessons||[]).flatMap(lesson=>{
    const sentences=(lesson.grammar||[]).filter(g=>typeof g.h==='string'&&g.h.trim()).slice(0,20).map(g=>({h:g.h,p:g.p||'',vi:g.v||''}));
    return sentences.length?[{id:course.id+':reading:'+lesson.number,title:'Bài '+lesson.number+' · '+(lesson.vi||lesson.title),topic:'Mẫu câu từ giáo trình',source:lesson.sourceNote||course.name,sentences}]:[];
  });
}
