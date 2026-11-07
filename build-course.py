import json
from pathlib import Path
root=Path(__file__).parent/'public'
titles=['AI小语，你好！','我叫李文','我是中国人','我有两个孩子','今天我休息','你的手机号是多少？','我晚上六点半下班','我爸爸也在医院工作','我明天上午在学校学习','这儿的苹果真便宜！','我读大学呢','昨天下雪了','请给我一杯茶','我看了一个电影','大兴机场见！']
vi=['Chào AI Tiểu Ngữ!','Tôi tên là Lý Văn','Tôi là người Trung Quốc','Tôi có hai người con','Hôm nay tôi nghỉ','Số điện thoại của bạn là bao nhiêu?','Tôi tan làm lúc sáu rưỡi tối','Bố tôi cũng làm việc ở bệnh viện','Sáng mai tôi học ở trường','Táo ở đây thật rẻ!','Tôi đang học đại học','Hôm qua tuyết rơi rồi','Cho tôi một cốc trà','Tôi đã xem một bộ phim','Hẹn gặp ở sân bay Đại Hưng!']
starts=[1,5,10,18,27,35,45,54,61,70,78,86,95,103,112];wb=[1,5,9,13,22,31,39,48,57,66,75,84,93,102,111]
wordgroups=[
'你好|nǐ hǎo|xin chào;老师|lǎoshī|giáo viên;您好|nín hǎo|xin chào (lịch sự);谢谢|xièxie|cảm ơn;不客气|bú kèqi|không có gì;再见|zàijiàn|tạm biệt;你|nǐ|bạn;您|nín|ông / bà / anh / chị (kính ngữ)',
'我|wǒ|tôi;叫|jiào|tên là / gọi;什么|shénme|cái gì;名字|míngzi|tên;学生|xuésheng|học sinh / sinh viên;对不起|duìbuqǐ|xin lỗi;没关系|méi guānxi|không sao;姓|xìng|họ / mang họ',
'是|shì|là;中国|Zhōngguó|Trung Quốc;人|rén|người;的|de|trợ từ sở hữu;吗|ma|trợ từ nghi vấn;不|bù|không;他|tā|anh ấy;她|tā|cô ấy;朋友|péngyou|bạn bè;汉语|Hànyǔ|tiếng Trung',
'有|yǒu|có;两|liǎng|hai (trước lượng từ);个|gè|lượng từ thông dụng;孩子|háizi|con / trẻ em;家|jiā|nhà / gia đình;一|yī|một;二|èr|hai;三|sān|ba;四|sì|bốn;五|wǔ|năm;六|liù|sáu;七|qī|bảy;八|bā|tám;九|jiǔ|chín;十|shí|mười;零|líng|không (số 0)',
'今天|jīntiān|hôm nay;休息|xiūxi|nghỉ ngơi;星期|xīngqī|tuần / thứ;年|nián|năm;月|yuè|tháng;号|hào|ngày / số;会|huì|biết làm (đã học);明天|míngtiān|ngày mai',
'手机|shǒujī|điện thoại di động;多少|duōshao|bao nhiêu;想|xiǎng|muốn / nghĩ;怎么|zěnme|thế nào / bằng cách nào;去|qù|đi;学校|xuéxiào|trường học;坐|zuò|ngồi / đi (phương tiện);车|chē|xe',
'晚上|wǎnshang|buổi tối;点|diǎn|giờ (thời điểm);半|bàn|nửa / rưỡi;下班|xiàbān|tan làm;上班|shàngbān|đi làm;现在|xiànzài|bây giờ;分|fēn|phút;呢|ne|trợ từ ngữ khí',
'爸爸|bàba|bố;妈妈|māma|mẹ;也|yě|cũng;在|zài|ở / tại;医院|yīyuàn|bệnh viện;工作|gōngzuò|làm việc / công việc;能|néng|có thể (khả năng / điều kiện);里|lǐ|bên trong',
'上午|shàngwǔ|buổi sáng;下午|xiàwǔ|buổi chiều;学习|xuéxí|học tập;书|shū|sách;桌子|zhuōzi|cái bàn;上|shàng|trên;下|xià|dưới;第|dì|tiền tố số thứ tự',
'这儿|zhèr|ở đây;苹果|píngguǒ|táo;真|zhēn|thật / thật là;便宜|piányi|rẻ;钱|qián|tiền;块|kuài|đồng (tiền, khẩu ngữ);贵|guì|đắt;怎么样|zěnmeyàng|như thế nào / ra sao',
'读|dú|đọc / học (trường);大学|dàxué|đại học;正在|zhèngzài|đang;要|yào|muốn / cần;看|kàn|xem / nhìn;书店|shūdiàn|hiệu sách;买|mǎi|mua;喜欢|xǐhuan|thích',
'昨天|zuótiān|hôm qua;下雪|xià xuě|tuyết rơi;天气|tiānqì|thời tiết;冷|lěng|lạnh;热|rè|nóng;了|le|trợ từ (hoàn thành / thay đổi);太|tài|quá / rất;下雨|xià yǔ|mưa',
'请|qǐng|mời / xin;给|gěi|cho / đưa cho;杯|bēi|cốc / lượng từ cốc;茶|chá|trà;可以|kěyǐ|có thể / được phép;一下|yíxià|một chút / một lát;水|shuǐ|nước;喝|hē|uống',
'电影|diànyǐng|phim;都|dōu|đều;吃饭|chī fàn|ăn cơm;见面|jiàn miàn|gặp mặt;昨天|zuótiān|hôm qua;饭|fàn|cơm / bữa ăn;吃|chī|ăn;一起|yìqǐ|cùng nhau',
'机场|jīchǎng|sân bay;见|jiàn|gặp;还|hái|còn / cũng;回|huí|về / quay lại;北京|Běijīng|Bắc Kinh;飞机|fēijī|máy bay;高兴|gāoxìng|vui vẻ;再|zài|lại / nữa'
]
grammars=[
[('Chào hỏi lịch sự','Gặp bạn bè, dùng 你好. Khi muốn bày tỏ sự kính trọng, dùng 您好. Trả lời 谢谢 bằng 不客气.','您好，老师！','Nín hǎo, lǎoshī!','Em chào thầy / cô!')],
[('Trật tự cơ bản: Ai + làm gì','Chủ ngữ đứng trước động từ. Để giới thiệu tên, dùng chủ ngữ + 叫 + tên.','我叫南。','Wǒ jiào Nán.','Tôi tên là Nam.')],
[('Câu với 是','Dùng chủ ngữ + 是 + danh từ để nói ai là ai. Phủ định dùng 不是.','我是越南人。','Wǒ shì Yuènán rén.','Tôi là người Việt Nam.'),('Sở hữu với 的 và câu hỏi 吗','的 nối người sở hữu và vật / người được nói đến. Thêm 吗 cuối câu trần thuật để hỏi có / không.','这是你的书吗？','Zhè shì nǐ de shū ma?','Đây có phải là sách của bạn không?')],
[('Có gì: 有 + số + lượng từ + danh từ','Dùng 两 trước lượng từ để đếm hai đơn vị. Phủ định của 有 là 没有.','我有两个朋友。','Wǒ yǒu liǎng gè péngyou.','Tôi có hai người bạn.'),('Hỏi tiếp bằng 呢','Đặt chủ đề + 呢 khi muốn hỏi lại cùng một vấn đề.','你呢？','Nǐ ne?','Còn bạn thì sao?')],
[('Nói ngày tháng','Năm → tháng → ngày. Trong khẩu ngữ, 号 được dùng để nói ngày trong tháng.','今天星期一。','Jīntiān xīngqīyī.','Hôm nay là thứ Hai.'),('Biết làm với 会','会 thường nói đến kỹ năng đã học được. Sau 会 là động từ.','我会说汉语。','Wǒ huì shuō Hànyǔ.','Tôi biết nói tiếng Trung.')],
[('Muốn làm gì: 想 + động từ','想 thể hiện mong muốn. Hỏi cách làm bằng 怎么 + động từ.','你想怎么去学校？','Nǐ xiǎng zěnme qù xuéxiào?','Bạn muốn đến trường bằng cách nào?'),('Chuỗi hành động','Có thể đặt liên tiếp các động từ có cùng chủ ngữ.','我去书店买书。','Wǒ qù shūdiàn mǎi shū.','Tôi đến hiệu sách mua sách.')],
[('Nói giờ và vị trí của thời gian','Thời gian thường đứng trước động từ: chủ ngữ + thời gian + hành động. 半 là rưỡi.','我晚上六点半下班。','Wǒ wǎnshang liù diǎn bàn xiàbān.','Tôi tan làm lúc sáu rưỡi tối.'),('吧 và 呢','吧 có thể làm lời đề nghị nhẹ nhàng hơn. 呢 có thể nhấn mạnh trạng thái đang tiếp diễn trong ngữ cảnh phù hợp.','我们走吧。','Wǒmen zǒu ba.','Chúng ta đi nhé.')],
[('Vị trí với 在','Chủ ngữ + 在 + địa điểm. Nếu có hành động, 在 + địa điểm thường đặt trước động từ hành động.','我爸爸也在医院工作。','Wǒ bàba yě zài yīyuàn gōngzuò.','Bố tôi cũng làm việc ở bệnh viện.'),('Khả năng với 能','能 nói đến khả năng hoặc điều kiện cho phép thực hiện hành động.','我今天能来。','Wǒ jīntiān néng lái.','Hôm nay tôi có thể đến.')],
[('Địa điểm + 有','Dùng để giới thiệu có người / vật ở một nơi.','桌子上有一本书。','Zhuōzi shàng yǒu yì běn shū.','Trên bàn có một quyển sách.'),('Thời gian trước địa điểm','Một thứ tự thông dụng: ai + khi nào + ở đâu + làm gì. 第 + số chỉ thứ tự.','我明天上午在学校学习。','Wǒ míngtiān shàngwǔ zài xuéxiào xuéxí.','Sáng mai tôi học ở trường.')],
[('Tính từ làm vị ngữ','Tính từ có thể trực tiếp làm vị ngữ. Trong câu đơn giản, 很 thường nối chủ ngữ với tính từ; không dùng 是 trong mẫu này.','这个苹果很便宜。','Zhège píngguǒ hěn piányi.','Quả táo này rẻ.'),('Hỏi đánh giá bằng 怎么样','Đặt chủ đề + 怎么样 để hỏi ý kiến hoặc tình trạng.','这儿的苹果怎么样？','Zhèr de píngguǒ zěnmeyàng?','Táo ở đây thế nào?')],
[('Hỏi bằng khẳng định + phủ định','Lặp động từ ở dạng khẳng định và phủ định; không thêm 吗 vào cùng mẫu câu.','你是不是学生？','Nǐ shì bu shì xuésheng?','Bạn có phải là sinh viên không?'),('Đang làm: 正在 + động từ','正在 nhấn mạnh hành động đang diễn ra. 要 + động từ thể hiện muốn hoặc cần làm.','我正在看书。','Wǒ zhèngzài kàn shū.','Tôi đang đọc sách.')],
[('了: tình huống thay đổi','了 ở cuối câu có thể báo một tình huống mới hoặc sự thay đổi; không phải lúc nào cũng là thì quá khứ.','下雪了。','Xià xuě le.','Tuyết rơi rồi.'),('太…了','Dùng 太 + tính từ + 了 để bày tỏ mức độ cao hoặc cảm thán.','今天太冷了！','Jīntiān tài lěng le!','Hôm nay lạnh quá!')],
[('可以: xin phép và cho phép','可以 + động từ thường dùng để hỏi hoặc nói điều được phép làm.','我可以坐这儿吗？','Wǒ kěyǐ zuò zhèr ma?','Tôi có thể ngồi đây không?'),('Động từ + 一下 và hai tân ngữ','一下 làm hành động nhẹ và ngắn hơn. 给 có thể đi cùng người nhận và vật được cho.','请给我一杯茶。','Qǐng gěi wǒ yì bēi chá.','Xin cho tôi một cốc trà.')],
[('了 sau động từ','Động từ + 了 thường biểu thị hành động đã được thực hiện. Có thể cần ngữ cảnh hoặc thời gian để xác định lúc xảy ra.','我昨天看了一个电影。','Wǒ zuótiān kàn le yí gè diànyǐng.','Hôm qua tôi đã xem một bộ phim.'),('Đều: 都 và từ li hợp','都 đặt trước động từ. Các từ như 见面, 吃饭 có cấu trúc động từ + tân ngữ, có thể tách trong một số cách dùng.','我们都喜欢这个电影。','Wǒmen dōu xǐhuan zhège diànyǐng.','Chúng tôi đều thích bộ phim này.')],
[('Bổ sung với 还 / 也','还 có thể bổ sung thêm một việc hoặc ý. 也 nêu sự tương đồng; hai từ thường đứng trước động từ.','我想喝茶，还想喝水。','Wǒ xiǎng hē chá, hái xiǎng hē shuǐ.','Tôi muốn uống trà, cũng muốn uống nước.')]
]
lessons=[]
for i in range(15):
 words=[dict(zip(['h','p','v'],w.split('|'))) for w in wordgroups[i].split(';')]
 grammar=[dict(zip(['title','explanation','h','p','v'],g)) for g in grammars[i]]
 end=starts[i+1]-1 if i<14 else 121
 wend=wb[i+1]-1 if i<14 else 120
 lessons.append({'id':f'l{i+1:02}','number':i+1,'title':titles[i],'vi':vi[i],'start':starts[i]+15,'end':end+15,'printedStart':starts[i],'workbookStart':wb[i]+7,'workbookEnd':wend+7,'words':words,'grammar':grammar,'sourceNote':f'Giáo trình trang {starts[i]}–{end}; giải thích tiếng Việt và từ trọng tâm do Hǎo biên soạn để hỗ trợ học, không phải bản chép toàn bộ danh mục từ mới.'})
course={'schemaVersion':1,'id':'hsk-1','level':'1','name':'HSK 1 · Giáo trình mới 2026','edition':'新HSK教程 1 · 2026','builtIn':True,'audioSource':'https://www.baulchino.com/new-hsk-audios-2026','documents':{'textbook':{'kind':'images','base':'/books/textbook/','count':144,'name':'hsk-course-1.PDF'},'workbook':{'kind':'images','base':'/books/workbook/','count':139,'name':'hsk-course-1-workbook.PDF'},'writing':{'kind':'images','base':'/books/writing/','count':15,'name':'hsk-course-1-writing.PDF'}},'lessons':lessons}
(root/'data'/'hsk-1.json').write_text(json.dumps(course,ensure_ascii=False,indent=2))
print('Generated',len(lessons),'lessons',sum(len(l['words']) for l in lessons),'focus cards')
