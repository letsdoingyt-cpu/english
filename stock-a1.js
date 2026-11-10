/* Формат строки: английское предложение с {ответ|глагол в скобках} ; перевод ; неверная форма ; почему */
STOCK.A1 = {
be: `
I {am|be} a student.;Я студент.;is;с I всегда am
She {is|be} my sister.;Она моя сестра.;are;she → is
They {are|be} at home now.;Они сейчас дома.;is;they → are
We {are|be} good friends.;Мы хорошие друзья.;am;we → are
He {isn't|not/be} hungry.;Он не голоден.;aren't;he → is, отрицание is not
{Are you|you/be} tired?;Ты устал?;Is you;в вопросе to be встаёт перед подлежащим, you → are
It {is|be} cold today.;Сегодня холодно.;are;it → is
My parents {are|be} doctors.;Мои родители — врачи.;is;parents = they → are
I {was|be} at school yesterday.;Вчера я был в школе.;were;yesterday → прошлое, I → was
They {were|be} happy last night.;Вчера вечером они были счастливы.;was;прошлое, they → were
{Is he|he/be} your brother?;Он твой брат?;Are he;вопрос: is перед he
The book {is|be} on the table.;Книга на столе.;are;the book = it → is
We {weren't|not/be} late yesterday.;Мы вчера не опоздали.;wasn't;прошлое, we → were not
I {am not|not/be} ready.;Я не готов.;is not;I → am, отрицание am not
Where {are|be} my keys?;Где мои ключи?;is;keys — множественное число → are
`,
ps: `
She {works|work} in a shop.;Она работает в магазине.;work;постоянный факт, she → глагол + s
I {like|like} green tea.;Я люблю зелёный чай.;likes;факт о себе, после I окончания нет
He {plays|play} football every Sunday.;Он играет в футбол каждое воскресенье.;play;every Sunday → привычка, he → + s
We {live|live} in a big city.;Мы живём в большом городе.;lives;постоянный факт, we → без s
My mother {cooks|cook} dinner every day.;Моя мама готовит ужин каждый день.;cook;every day → регулярное действие
They {don't eat|not/eat} meat.;Они не едят мясо.;doesn't eat;отрицание: they → don't + глагол
He {doesn't like|not/like} milk.;Он не любит молоко.;don't like;отрицание: he → doesn't + глагол
{Do you speak|you/speak} English?;Ты говоришь по-английски?;Does you speak;вопрос: do + you + глагол
{Does she have|she/have} a dog?;У неё есть собака?;Do she have;вопрос: she → does
I {get|get} up at seven every morning.;Я встаю в семь каждое утро.;gets;every morning → привычка
The shop {opens|open} at nine.;Магазин открывается в девять.;open;расписание → Present Simple, it → + s
Tom {goes|go} to school by bus.;Том ездит в школу на автобусе.;go;обычное действие, he → goes
We often {watch|watch} films at the weekend.;Мы часто смотрим фильмы по выходным.;watches;often → привычка
She {has|have} two brothers.;У неё два брата.;have;факт, she → has
My dad {doesn't drink|not/drink} coffee.;Мой папа не пьёт кофе.;doesn't drinks;после doesn't глагол без s
`,
pc: `
I {am reading|read} a book now.;Я сейчас читаю книгу.;am read;now → действие в момент речи
She {is cooking|cook} dinner at the moment.;Она сейчас готовит ужин.;is cook;at the moment → процесс сейчас
They {are playing|play} in the garden now.;Они сейчас играют в саду.;is playing;now, they → are + ing
Look! It {is raining|rain}.;Смотри! Идёт дождь.;is rain;Look! → происходит на глазах
He {isn't sleeping|not/sleep} now.;Он сейчас не спит.;don't sleeping;now → is not + ing
{Are you listening|you/listen} to me?;Ты меня слушаешь?;Do you listening;вопрос о моменте речи: are + you + ing
We {are waiting|wait} for the bus now.;Мы сейчас ждём автобус.;are wait;now → процесс
What {are you doing|you/do} now?;Что ты сейчас делаешь?;you are doing;в вопросе are перед you
My brother {is watching|watch} TV right now.;Мой брат прямо сейчас смотрит телевизор.;are watching;right now, he → is + ing
I {am not working|not/work} today.;Сегодня я не работаю.;am not work;today → временная ситуация
The children {are sleeping|sleep} now.;Дети сейчас спят.;is sleeping;children = they → are
Listen! She {is singing|sing}.;Слушай! Она поёт.;is sing;Listen! → действие прямо сейчас
{Is he doing|he/do} his homework now?;Он сейчас делает уроки?;Does he doing;вопрос: is + he + ing
Mum {is talking|talk} on the phone at the moment.;Мама сейчас говорит по телефону.;talking;нужен вспомогательный is
We {are having|have} lunch now.;Мы сейчас обедаем.;are have;now → are + having
`,
past: `
I {went|go} to the park yesterday.;Вчера я ходил в парк.;goed;yesterday → прошлое, go — went
She {watched|watch} a film last night.;Вчера вечером она посмотрела фильм.;watch;last night → законченное действие
We {played|play} football last Sunday.;В прошлое воскресенье мы играли в футбол.;plaied;last Sunday → прошлое, play + ed
He {didn't come|not/come} to school yesterday.;Вчера он не пришёл в школу.;didn't came;после didn't — первая форма
{Did you see|you/see} Tom yesterday?;Ты вчера видел Тома?;Did you saw;вопрос: did + первая форма
They {had|have} a party last week.;На прошлой неделе у них была вечеринка.;haved;last week, have — had
I {bought|buy} a new phone last month.;В прошлом месяце я купил новый телефон.;buyed;last month, buy — bought
My friend {called|call} me an hour ago.;Друг позвонил мне час назад.;call;an hour ago → прошлое
We {ate|eat} pizza yesterday evening.;Вчера вечером мы ели пиццу.;eated;yesterday, eat — ate
She {didn't like|not/like} the film.;Фильм ей не понравился.;didn't liked;после didn't — первая форма
I {saw|see} him two days ago.;Я видел его два дня назад.;seed;two days ago, see — saw
He {came|come} home late yesterday.;Вчера он пришёл домой поздно.;comed;yesterday, come — came
{Did they go|they/go} to the cinema last night?;Они ходили в кино вчера вечером?;Did they went;вопрос: did + первая форма
I {made|make} a cake yesterday.;Вчера я испёк торт.;maked;yesterday, make — made
We {lived|live} in London in 2015.;В 2015 году мы жили в Лондоне.;live;in 2015 → законченный период
`,
fs: `
I {will call|call} you tomorrow.;Я позвоню тебе завтра.;will calling;tomorrow, обещание → will + глагол
She {will be|be} ten next year.;В следующем году ей будет десять.;will is;next year, после will — be
I think it {will rain|rain} tomorrow.;Думаю, завтра будет дождь.;will rains;I think → прогноз
We {won't be|not/be} late.;Мы не опоздаем.;won't to be;обещание, will not + глагол без to
{Will you help|you/help} me?;Ты мне поможешь?;Will you helping;просьба: will + you + глагол
They {will come|come} next week.;Они приедут на следующей неделе.;will came;next week → will + первая форма
Don't worry, I {will open|open} the door.;Не волнуйся, я открою дверь.;will to open;решение в момент речи
He {won't like|not/like} this film.;Ему не понравится этот фильм.;won't likes;прогноз, после won't окончания нет
I {will buy|buy} some bread later.;Я куплю хлеба позже.;will bought;later → будущее
Maybe we {will go|go} to the sea next summer.;Может быть, следующим летом мы поедем на море.;will went;maybe → неуверенный прогноз
{Will she be|she/be} at home tonight?;Она будет дома сегодня вечером?;Will she is;вопрос: will + she + be
I am sure you {will pass|pass} the test.;Я уверен, ты сдашь тест.;will passed;I am sure → прогноз
It {will be|be} cold tomorrow.;Завтра будет холодно.;wills be;tomorrow, will не меняется по лицам
We {will see|see} you soon.;Скоро увидимся.;will saw;soon → будущее
I {won't forget|not/forget} you.;Я тебя не забуду.;won't forgot;обещание: won't + первая форма
`,
gt: `
I {am going to visit|visit} my grandmother tomorrow.;Завтра я собираюсь навестить бабушку.;am going visit;готовый план → am going to
She {is going to buy|buy} a new dress.;Она собирается купить новое платье.;is going to buys;намерение, после to — первая форма
We {are going to watch|watch} a film tonight.;Сегодня вечером мы собираемся посмотреть фильм.;is going to watch;план на вечер, we → are
Look at the clouds! It {is going to rain|rain}.;Посмотри на тучи! Сейчас пойдёт дождь.;going to rain;видим признаки → going to
They {are going to play|play} tennis on Saturday.;В субботу они собираются играть в теннис.;are going to playing;план, после to — первая форма
He {isn't going to come|not/come} to the party.;Он не собирается приходить на вечеринку.;isn't going come;намерение, нужна частица to
{Are you going to cook|you/cook} dinner tonight?;Ты собираешься готовить ужин сегодня?;Do you going to cook;вопрос о планах: are + you + going to
I {am not going to eat|not/eat} this.;Я не собираюсь это есть.;am not going eat;намерение, going to + глагол
What {are you going to do|you/do} this weekend?;Что ты собираешься делать в выходные?;you are going to do;вопрос о планах, are перед you
My dad {is going to wash|wash} the car today.;Папа сегодня собирается помыть машину.;are going to wash;план, he → is
We {are going to have|have} a party next Friday.;В следующую пятницу мы устраиваем вечеринку.;are going have;готовый план
{Is she going to call|she/call} him?;Она собирается ему позвонить?;Does she going to call;вопрос: is + she + going to
I {am going to learn|learn} English this year.;В этом году я собираюсь учить английский.;am going to learning;намерение
They {aren't going to sell|not/sell} their house.;Они не собираются продавать дом.;aren't going to sold;намерение, после to — первая форма
Be careful! You {are going to fall|fall}.;Осторожно! Ты сейчас упадёшь.;is going to fall;видно, что случится → going to
`
};
