let isScrolling = false;
let lastScrollTime = 0;
const SCROLL_DEBOUNCE = 30;
class CustomDiagram {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Контейнер #${containerId} не найден!`);
            return;
        }

        this.tooltip = this.container.querySelector('.tooltip');
        if (!this.tooltip) {
            console.error('Элемент тултипа не найден!');
            return;
        }

        this.config = {
            type: 'line',
            width: 560,
            height: 380,
            margin: 70,
            gridSteps: 6,
            data: [],
            labels: [],
            colors: ['#27ae60'],
            precision: 0,
            ...config
        };

        this.bars = [];
        this.init();
        this.addInteractivity();
    }

    init() {
        this.createCanvas();
        this.createOverlay();
        this.calculateScales();
        this.draw();
    }

    createCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas = document.createElement('canvas');
        
        this.canvas.style.width = `${this.config.width}px`;
        this.canvas.style.height = `${this.config.height}px`;
        this.canvas.width = this.config.width * dpr;
        this.canvas.height = this.config.height * dpr;
        
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.ctx.scale(dpr, dpr);
        this.ctx.font = '14px Arial';
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'overlay';
        this.overlay.style.width = `${this.config.width}px`;
        this.overlay.style.height = `${this.config.height}px`;
        this.container.appendChild(this.overlay);
    }

    calculateScales() {
        const values = this.config.data.flat();
        this.minY = Math.min(0, ...values);
        this.maxY = Math.max(...values);
        
        const range = this.maxY - this.minY;
        const power = Math.pow(10, Math.floor(Math.log10(range || 1)));
        this.yStep = this.calculateOptimalStep(range, power);
        this.maxY = Math.ceil(this.maxY / this.yStep) * this.yStep;

        this.plotWidth = this.config.width - this.config.margin * 2;
        this.plotHeight = this.config.height - this.config.margin * 2;
        
        if(this.config.type === 'bar') {
            this.barAreaWidth = this.plotWidth / this.config.data[0].length;
            this.barWidth = this.barAreaWidth * 0.7;
        } else {
            this.scaleX = this.plotWidth / (this.config.data[0].length - 1);
        }
        
        this.scaleY = this.plotHeight / (this.maxY - this.minY);
    }

    calculateOptimalStep(range, power) {
        const steps = [1, 2, 5, 10];
        const scaledSteps = steps.map(s => s * power);
        return scaledSteps.find(s => s * 5 >= range) || 10 * power;
    }

    draw() {
        this.clearCanvas();
        this.drawGrid();
        this.drawAxes();
        this.drawChart();
        this.drawLabels();
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.config.width, this.config.height);
    }

    drawGrid() {
        this.ctx.strokeStyle = '#e8e8e8';
        this.ctx.lineWidth = 1;
        
        const xStep = this.config.type === 'bar' ? this.barAreaWidth : this.scaleX;
        for (let i = 0; i <= this.config.data[0].length; i++) {
            const x = this.config.margin + i * xStep;
            this.drawLine(x, this.config.margin, x, this.config.height - this.config.margin);
        }

        for (let y = this.minY; y <= this.maxY; y += this.yStep) {
            const screenY = this.getYPosition(y);
            this.drawLine(this.config.margin, screenY, this.config.width - this.config.margin, screenY);
        }
    }

    drawLine(x1, y1, x2, y2) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    drawAxes() {
        this.ctx.strokeStyle = '#606060';
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.moveTo(this.config.margin, this.getYPosition(0));
        this.ctx.lineTo(this.config.width - this.config.margin, this.getYPosition(0));
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.config.margin, this.config.margin);
        this.ctx.lineTo(this.config.margin, this.config.height - this.config.margin);
        this.ctx.stroke();
    }

    drawLabels() {
        this.ctx.fillStyle = '#404040';
        this.ctx.textBaseline = 'middle';

        // Обработка подписей оси X
        this.config.labels.forEach((label, i) => {
            const x = this.config.margin + 
                     (this.config.type === 'bar' 
                        ? i * this.barAreaWidth + this.barAreaWidth/2 
                        : i * this.scaleX);
            const y = this.getYPosition(0) + 30;

            if (label.length > 5) {
                this.ctx.save();
                this.ctx.translate(x, y);
                this.ctx.rotate(-Math.PI/4);
                this.ctx.textAlign = 'right';
                this.ctx.fillText(label, 0, 0);
                this.ctx.restore();
            } else {
                this.ctx.textAlign = 'center';
                this.ctx.fillText(label, x, y);
            }
        });

        // Подписи оси Y
        this.ctx.textAlign = 'right';
        for (let y = this.minY; y <= this.maxY; y += this.yStep) {
            const screenY = this.getYPosition(y);
            this.ctx.fillText(y.toFixed(this.config.precision), this.config.margin - 10, screenY);
        }
    }

    drawChart() {
        if(this.config.type === 'line') this.drawLineChart();
        if(this.config.type === 'bar') this.drawBarChart();
    }

    drawLineChart() {
        this.config.data.forEach((dataset, i) => {
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.config.colors[i];
            this.ctx.lineWidth = 3;
            this.ctx.lineJoin = 'round';

            dataset.forEach((value, j) => {
                const x = this.config.margin + j * this.scaleX;
                const y = this.getYPosition(value);

                if(j === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();
        });
    }

    drawBarChart() {
        this.bars = [];
        this.config.data.forEach((dataset, di) => {
            this.ctx.fillStyle = this.config.colors[di];
            
            dataset.forEach((value, i) => {
                const x = this.config.margin + 
                         i * this.barAreaWidth + 
                         (this.barAreaWidth - this.barWidth)/2;
                const y = this.getYPosition(value);
                const height = this.getYPosition(0) - y;

                this.ctx.fillRect(x, y, this.barWidth, height);

                this.bars.push({
                    x: x,
                    y: y,
                    width: this.barWidth,
                    height: height,
                    value: value,
                    label: this.config.labels[i]
                });
            });
        });
    }

    addInteractivity() {
        this.overlay.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if(this.config.type === 'line') {
                this.handleLineHover(x, y);
            } else {
                this.handleBarHover(x, y);
            }
        });

        this.overlay.addEventListener('mouseleave', () => this.hideTooltip());
    }

    handleLineHover(x, y) {
        const dataIndex = Math.round((x - this.config.margin) / this.scaleX);
        if (dataIndex >= 0 && dataIndex < this.config.data[0].length) {
            const value = this.config.data[0][dataIndex];
            const exactY = this.getYPosition(value);
            
            if (Math.abs(y - exactY) < 15) {
                this.showTooltip(
                    x,
                    exactY - 10,
                    `${this.config.labels[dataIndex]}: ${value.toLocaleString()}`
                );
                return;
            }
        }
        this.hideTooltip();
    }

    handleBarHover(x, y) {
        for (const bar of this.bars) {
            if (x >= bar.x && x <= bar.x + bar.width &&
                y >= bar.y && y <= bar.y + bar.height) {
                this.showTooltip(
                    bar.x + bar.width/2,
                    bar.y - 5,
                    `${bar.label}: ${bar.value.toFixed(1)} ч`
                );
                return;
            }
        }
        this.hideTooltip();
    }

    showTooltip(x, y, text) {
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
        this.tooltip.textContent = text;
        this.tooltip.style.opacity = '1';
    }

    hideTooltip() {
        this.tooltip.style.opacity = '0';
    }

    getYPosition(value) {
        return this.config.height - this.config.margin - 
              (value - this.minY) * this.scaleY;
    }
}
function unifiedScroll() {
    const now = Date.now();
    if (!isScrolling && (now - lastScrollTime) > SCROLL_DEBOUNCE) {
        isScrolling = true;
        
        // Плавный скролл только когда рядом с низом
        const isNearBottom = chatBox.scrollHeight - chatBox.clientHeight - chatBox.scrollTop < 100;
        
        requestAnimationFrame(() => {
            if (isNearBottom) {
                chatBox.scrollTo({
                    top: chatBox.scrollHeight,
                    behavior: 'smooth'
                });
            } else {
                // Если пользователь прокручивает вверх - не мешать
                chatBox.scrollTop = chatBox.scrollHeight;
            }
            
            isScrolling = false;
            lastScrollTime = now;
        });
    }
}


async function sendMessage() {
    // Получаем элементы интерфейса
    const input = document.getElementById('userInput');
    const chatBox = document.getElementById('chatBox');
    const prompt = input.value.trim();

    // Проверяем наличие запроса
    if (!prompt) return;

    // Очищаем поле ввода и блокируем его
    input.value = '';
    input.disabled = true;

    // Создаем элемент для сообщения пользователя
    const userDiv = document.createElement('div');
    userDiv.className = 'message user-message';
    userDiv.textContent = prompt;
    chatBox.appendChild(userDiv);

    // Создаем контейнер для процесса мышления
    const thinkingContainer = document.createElement('div');
    thinkingContainer.className = 'thinking-container';
    
    const header = document.createElement('div');
    header.className = 'thinking-header';
    header.textContent = 'Процесс мышления AI';
    thinkingContainer.appendChild(header);

    const thinkingContent = document.createElement('div');
    thinkingContent.className = 'thinking-content';
    thinkingContainer.appendChild(thinkingContent);
    
    chatBox.appendChild(thinkingContainer);

    // Создаем контейнер для финального ответа
    const finalResponseDiv = document.createElement('div');
    finalResponseDiv.className = 'final-response';
    chatBox.appendChild(finalResponseDiv);

    // Прокручиваем чат вниз
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        // Отправляем запрос на сервер
        const response = await fetch('http://localhost:8090/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });

        // Обрабатываем потоковый ответ
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResponseCache = '';
        let lastUpdate = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Декодируем полученные данные
            buffer += decoder.decode(value, { stream: true });

            // Обрабатываем все завершенные сообщения
            while (buffer.includes('\n\n')) {
                const splitIndex = buffer.indexOf('\n\n');
                const rawLine = buffer.slice(0, splitIndex);
                buffer = buffer.slice(splitIndex + 2);

                if (rawLine.startsWith('data: ')) {
                    try {
                        setTimeout(() => {
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }, 0);
                        const data = JSON.parse(rawLine.slice(6));

                        chatBox.scrollTop = chatBox.scrollHeight;

                        if (data.type === 'thinking') {
                            // Добавляем мыслительный процесс
                            //const p = document.createElement('p');
                            //p.textContent = data.content;
                            //thinkingContent.appendChild(p);
                            const wrapper = document.createElement('div');
                            wrapper.innerHTML = data.content;
                            thinkingContent.insertAdjacentHTML('beforeend', wrapper.innerHTML);
                            unifiedScroll()
                        } else if (data.type === 'final') {
                            // Накопление финального ответа
                            finalResponseCache += data.content;
                            unifiedScroll()
                            // Оптимизированное обновление (не чаще 50мс)
                            const now = Date.now();
                            if (now - lastUpdate > 50) {
                                finalResponseDiv.innerHTML = finalResponseCache;
                                chatBox.scrollTop = chatBox.scrollHeight;
                                lastUpdate = now;
                            }
                        } //else if (data.type === 'diagram') {
                        //     let diagram_id = 'diagram' + data.message_id
            //                 let diagram_label = data.content.label;
            //                 finalResponseCache += `<div class="chart-card">
            // <h3>${diagram_label}</h3>
            // <div id="${diagram_id}" class="diagram">
            //     <div class="tooltip"></div>
            // </div></div>`
            //                 unifiedScroll()
            //                 finalResponseDiv.innerHTML = finalResponseCache;
            //                 chatBox.scrollTop = chatBox.scrollHeight;
            //                 setTimeout(() => {
            //                     window.addEventListener('DOMContentLoaded', () => {
            //                 new CustomDiagram(diagram_id, {'type': data.content.type, 'data': data.content.y_values, 'labels': data.content.x_values});});
            //                 unifiedScroll()}, 50);
            //             }



//             else if (data.type === 'diagram') {
//   const diagram_id = `diagram-${Date.now()}-${Math.random().toString(36)}`;
  
//   // Добавляем структуру в DOM
//   finalResponseDiv.insertAdjacentHTML('beforeend', `
//     <div class="chart-card">
//       <h3>${data.content.label}</h3>
//       <div id="${diagram_id}" class="diagram-container">
//         <div class="tooltip"></div>
//       </div>
//     </div>
//   `);

//   // Задержка для гарантии создания DOM
//   setTimeout(() => {
//     try {
//       new CustomDiagram(diagram_id, {
//         type: data.content.type,
//         data: data.content.y_values, // Оборачиваем в массив
//         labels: data.content.x_values,
//         colors: ['#4CAF50', '#2196F3'] // Пример цветов
//       });
//     } catch (e) {
//       console.error('Ошибка создания диаграммы:', e);
//     }
//   }, 50);
  
//   unifiedScroll();
// }
                    } catch (e) {
                        console.error('Ошибка парсинга JSON:', e);
                    }
                }
            }

            // Прокручиваем чат
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        // Финализация - обновляем контейнер с последними данными
        finalResponseDiv.innerHTML = finalResponseCache;
        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (error) {
        // Обработка ошибок
        console.error('Ошибка:', error);
        finalResponseDiv.textContent = `Ошибка: ${error.message}`;
    } finally {
        // Разблокируем поле ввода
        input.disabled = false;
        input.focus();
        
    }
}

// Добавляем обработчик для клавиши Enter
function handleEnter(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function toggleExpandable(btn) {
    const wrapper = btn.nextElementSibling;
    const isOpen = btn.classList.toggle('active');
    
    wrapper.style.maxHeight = isOpen 
        ? wrapper.scrollHeight + 'px'
        : '0';
}


document.getElementById('userInput').addEventListener('keydown', handleEnter);