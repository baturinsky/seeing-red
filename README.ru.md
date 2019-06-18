# Seeing Red

**Анти-анти-хоррор про управление гневом.**

Исходники - https://github.com/baturinsky/seeing-red
Играть - https://baturinsky.github.io/seeing-red/index.html?seed=12&mobs=12&flowers=4&size=[70,70]&empty=0.35

![screenshot](https://github.com/baturinsky/seeing-red/screenshot.png)

Не собирался учавствовать в джеме, но вдруг вспомнилась идея, которая хорошо подходит к теме, и к тому же которую можно довольно быстро реализовать.

Чего мы обычно боимся в хоррорах? Того, что нас, условно говоря, съест Черт.

Но проблема в том, что съесть он нас может только один раз, и на этом игра закончится. Поэтому, на самом деле этого вместо этого мы каждый раз просто вовращаемя назад к сейчу или чекпойнту и пробуем снова, пока не получится. И это мешает боятся по-настоящему.

Конечно, умелый разработчик все равно сможет нагнести атмосферу, а пугливый игрок - ее прочувствовать.
Но все-таки.

Поэтому, чтобы сделать страх более обоснованным, я решил попробовать перевернуть формулу хоррора, причем дважды.

Во-первых, игрок сам становится Чертом. Это довольно часто встречается в играх, правда хоррорами они при этом как правило быть перестают.

Но сделаем еще один переворот. Черт людей есть не совсем хочет. Т.е. части его сознания только давай человечинки, а другая, которой управляет игрок, от этого в ужасе. И вторая пытается первую обуздать. Ну или нет - решать игроку.

Получается, что цена каждого провала - смерть. Но не нас, а кого-то другого. Но смерть.

# Реализация

Я давно смотрю в сторону HTML/Javascript как платформу для разработки, поэтому решил посмотреть что из готового можно использовать.
В частности, нужны реализации поиска пути и области видимости. И то и другое я нашел в https://ondras.github.io/rot.js - библиотеке для написания roguelike. Подумав, я решил, почему бы действительно не сделать классический roguelike - с псевдографикой и всем таким. Ну и что, что это Indie Jam а не 7DRL. Абстрактная графика может даже помочь привести в гармонию замутненное сознание протагониста и сомнения игрока по поводу того, что каждый символ символизирует.

Попробовал, получилось, причем даже легче и быстрее, чем предполагалось. На все про все, включая написание этого текста вышло три дня.
Получился вполне себе stealth horror, хотя, конечно, и в минимальной конфигурации. 

Но искомая механика присутствует.

# Сюжет

*They Look Like Monsters To You?*

Мы гуляем по лесу и собираем цветочки для девушки. В лесу, правда, водятся всякие монстры, которых лучше избегать.
Они очень злые, и их вид, и даже запах очень нам неприятен. К счастью, убиваются они легко.

По мере сбора цветочков мы вспоминаем (в виде текстовых вставок - пока не реализовано), как с этой девушкой познакомились. И в процессе этих воспоминаний постепенно понимаем, что это за монстры и почему этих цветов четное число.

Игра заканчивается разговором с девушкой (plot twist - воображаемым) и решением, на какой стадии принятия протагонист находится.

# Дальнейшие планы

Самому хотелось бы знать, если честно. В рамках джема - реализация сюжета, как в виде текста, так и в виде механик. Текст - в основном воспоминания персонажа и его мысли по поводу "монстров" и прочего, что он встретит на жизненном пути. Механики - более осмысленное и разнообразное поведение NPC.
Скажем, при виде расчлененки и ее автора они будут разбегаться и звать охрану.

Вобщем, хотелось бы услышать мнение старших отварищей по поводу того, в кукую сторону двигаться (и двигаться ли вообще)