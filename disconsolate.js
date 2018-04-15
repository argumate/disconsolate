
var disconsolate = {};

void function() {

function attr_from_num(num) {
    var fg = num & 0xf;
    var bg = (num >> 4) & 0xf;
    var blink = Boolean((num >> 8) & 0x1);
    return {fg: fg, bg: bg, blink: blink};
}

function attr_num(attr) {
    var fg = attr.fg || 0;
    var bg = attr.bg || 0;
    var blink = attr.blink ? 1 : 0;
    return (blink << 8) | (bg << 4) | fg;
}

function attr_mask(attr) {
    var fg_mask = "fg" in attr ? 0xf : 0;
    var bg_mask = "bg" in attr ? 0xf0 : 0;
    var blink_mask = "blink" in attr ? 0x100 : 0;
    return fg_mask | bg_mask | blink_mask;
}

function attr_combine(mask, old_attr, new_attr) {
    return (old_attr & ~mask) | new_attr;
}

disconsolate.Screen = function(w, h) {
    this.w = w;
    this.h = h;
    this.vram = new Uint32Array(this.w * this.h);
    this.element = document.createElement("pre");
    this.element.className = "disconsolate";
    var self = this;
    this.element.addEventListener("click", function(ev) {
        var x = Math.floor((ev.offsetX+ev.target.offsetLeft)/8);
        var y = Math.floor((ev.offsetY+ev.target.offsetTop)/16);
        if (self.root) {
            var widget = self.root.pick(x, y);
            if (widget && widget.click) {
                widget.click();
            }
        }
    }, false);
    this.root = null;
    this.lines = [];

    for (var y = 0; y < this.h; ++y) {
        var line = document.createElement("span");
        line.textContent = " ".repeat(this.w);
        var nl = document.createTextNode("\n");
        this.element.appendChild(line);
        this.element.appendChild(nl);
        this.lines.push(line);
    }
};

disconsolate.Screen.prototype.setChar = function(x, y, ch, attr) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) {
        attr = attr || {};
        var old_attr = this.vram[y*this.w+x] >> 21;
        var new_attr = attr_num(attr);
        attr = attr_combine(attr_mask(attr), old_attr, new_attr);
        this.vram[y*this.w+x] = ch.charCodeAt(0) | (attr << 21);
    }
};

disconsolate.Screen.prototype.setRow = function(x, y, w, ch, attr) {
    for (var i = 0; i < w; ++i) {
        this.setChar(x+i, y, ch, attr);
    }
};

disconsolate.Screen.prototype.setCol = function(x, y, h, ch, attr) {
    for (var i = 0; i < h; ++i) {
        this.setChar(x, y+i, ch, attr);
    }
};

disconsolate.Screen.prototype.setRect = function(x, y, w, h, ch, attr) {
    for (var i = 0; i < h; ++i) {
        this.setRow(x, y+i, w, ch, attr);
    }
};

disconsolate.Screen.prototype.setText = function(x, y, str, attr) {
    for (var i = 0; i < str.length; ++i) {
        this.setChar(x+i, y, str.charAt(i), attr);
    }
};

disconsolate.Screen.prototype.refresh = function() {
    for (var y = 0; y < this.h; ++y) {
        var line = this.lines[y];
        line.innerHTML = "";
        var span_chars = "";
        var span_attr = 0;
        for (var x = 0; x < this.w; ++x) {
            var ch = this.vram[y*this.w+x];
            var attr = ch >> 21;
            if (!x) span_attr = attr;
            ch &= 0x1fffff;
            ch = ch ? String.fromCharCode(ch) : " ";
            if (span_attr != attr)
            {
                line.appendChild(make_span(span_chars, span_attr));
                span_chars = "";
                span_attr = attr;
            }
            span_chars += ch;
        }
        line.appendChild(make_span(span_chars, span_attr));
    }

    function make_span(chars, attr) {
        attr = attr_from_num(attr);
        var className = "fg"+attr.fg+" bg"+attr.bg;
        if (attr.blink) className += " blink";
        var span = document.createElement("span");
        span.textContent = chars;
        span.className = className;
        return span;
    }
};

disconsolate.Widget = function() { };

disconsolate.Widget.subclass = function(props) {
    props.constructor.prototype = Object.create(this.prototype);
    for (var i in props) {
        props.constructor.prototype[i] = props[i];
    }
    return props.constructor;
};

disconsolate.Widget.prototype.pick = function(x, y) {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) {
        return this;
    } else {
        return null;
    }
};

disconsolate.Root = disconsolate.Widget.subclass({
    constructor: function(w, h, child, x, y) {
        this.w = w;
        this.h = h;
        this.child = child;
        this.x = x;
        this.y = y;
    },
    layout: function() {
        this.child.layout();
    },
    draw: function(screen, _x, _y) {
        this.child.draw(screen, this.x, this.y);
    },
    pick: function(x, y) {
        return this.child.pick(x - this.x, y - this.y);
    }
});

disconsolate.Label = disconsolate.Widget.subclass({
    constructor: function(text, attrs) {
        this.text = text;
        this.attrs = attrs;
        this.layout();
    },
    layout: function() {
        this.w = this.text.length;
        this.h = 1;
    },
    draw: function(screen, x, y) {
        screen.setText(x, y, this.text, this.attrs);
    }
});

disconsolate.Padding = disconsolate.Widget.subclass({
    constructor: function(pad, child) {
        this.pad = {
            left: pad.left || pad.hori || 0,
            right: pad.right || pad.hori || 0,
            top: pad.top || pad.vert || 0,
            bottom: pad.bottom || pad.vert || 0
        };
        this.child = child;
    },
    layout: function() {
        this.w = this.pad.left + this.pad.right;
        this.h = this.pad.top + this.pad.bottom;
        if (this.child) {
            this.child.layout();
            this.w += this.child.w;
            this.h += this.child.h;
        }
    },
    draw: function(screen, x, y) {
        if (this.child) {
            this.child.draw(screen, x+this.pad.left, y+this.pad.top);
        }
    },
    pick: function(x, y) {
        if (this.child) {
            return this.child.pick(x-this.pad.left, y-this.pad.top);
        } else {
            return null;
        }
    }
});

disconsolate.Frame = disconsolate.Widget.subclass({
    constructor: function(box, title, child, attrs) {
        this.box = box;
        this.title = " "+title+" ";
        this.child = child;
        this.attrs = attrs;
    },
    layout: function() {
        this.w = 2;
        this.h = 2;
        if (this.child) {
            this.child.layout();
            this.w += this.child.w;
            this.h += this.child.h;
        }
        this.w = Math.max(this.w, this.title.length+2);
    },
    draw: function(screen, x, y) {
        var box = this.box;
        screen.setRect(x, y, this.w, this.h, " ", this.attrs);
        screen.setChar(x, y, box.top_left);
        screen.setChar(x+this.w-1, y, box.top_right);
        screen.setChar(x, y+this.h-1, box.bottom_left);
        screen.setChar(x+this.w-1, y+this.h-1, box.bottom_right);
        screen.setRow(x+1, y, this.w-2, box.hori);
        screen.setRow(x+1, y+this.h-1, this.w-2, box.hori);
        screen.setCol(x, y+1, this.h-2, box.vert);
        screen.setCol(x+this.w-1, y+1, this.h-2, box.vert);
        screen.setText(Math.floor(x+(this.w-this.title.length)/2), y, this.title);
        if (this.child) this.child.draw(screen, x+1, y+1);
    },
    pick: function(x, y) {
        if (this.child) {
            return this.child.pick(x-1, y-1);
        } else {
            return null;
        }
    }
});

disconsolate.Frame3d = disconsolate.Widget.subclass({
    constructor: function(box, title, child, attrs, dark_attrs) {
        this.box = box;
        this.title = " "+title+" ";
        this.child = child;
        this.attrs = attrs;
        this.dark_attrs = dark_attrs;
    },
    layout: function() {
        this.w = 2;
        this.h = 2;
        if (this.child) {
            this.child.layout();
            this.w += this.child.w;
            this.h += this.child.h;
        }
        this.w = Math.max(this.w, this.title.length+2);
    },
    draw: function(screen, x, y) {
        var box = this.box;
        screen.setRect(x, y, this.w, this.h, " ", this.attrs);
        screen.setChar(x, y, box.top_left);
        screen.setChar(x+this.w-1, y, box.top_right, this.dark_attrs);
        screen.setChar(x, y+this.h-1, box.bottom_left);
        screen.setChar(x+this.w-1, y+this.h-1, box.bottom_right, this.dark_attrs);
        screen.setRow(x+1, y, this.w-2, box.hori);
        screen.setRow(x+1, y+this.h-1, this.w-2, box.hori, this.dark_attrs);
        screen.setCol(x, y+1, this.h-2, box.vert);
        screen.setCol(x+this.w-1, y+1, this.h-2, box.vert, this.dark_attrs);
        screen.setText(Math.floor(x+(this.w-this.title.length)/2), y, this.title);
        if (this.child) this.child.draw(screen, x+1, y+1);
    },
    pick: function(x, y) {
        if (this.child) {
            return this.child.pick(x-1, y-1);
        } else {
            return null;
        }
    }
});

disconsolate.Grid = disconsolate.Widget.subclass({
    constructor: function(cells) {
        this.cells = cells;
    },
    layout: function() {
        this.cols = [];
        this.rows = [];
        this.w = 0;
        this.h = 0;
        for (var i = 0; i < this.cells.length; ++i) {
            var row = this.cells[i];
            var row_h = 0;
            for (var j = 0; j < row.length; ++j) {
                row[j].layout();
                if (this.cols.length < j+1) {
                    this.cols.push({w: row[j].w});
                } else {
                    this.cols[j].w = Math.max(this.cols[j].w, row[j].w);
                }
                row_h = Math.max(row_h, row[j].h);
            }
            this.rows.push({h: row_h});
            this.h += row_h;
        }
        for (var i = 0; i < this.cols.length; ++i) {
            this.w += this.cols[i].w;
        }
    },
    draw: function(screen, x, y) {
        var y_off = y;
        for (var i = 0; i < this.cells.length; ++i) {
            var row = this.cells[i];
            var x_off = x;
            for (var j = 0; j < row.length; ++j) {
                row[j].draw(screen, x_off, y_off);
                x_off += this.cols[j].w;
            }
            y_off += this.rows[i].h;
        }
    },
    pick: function(x, y) {
        var i, j;
        for (i = 0; i < this.rows.length - 1; ++i) {
            if (y < this.rows[i].h) break;
            y -= this.rows[i].h;
        }
        for (j = 0; j < this.cols.length - 1; ++j) {
            if (x < this.cols[j].w) break;
            x -= this.cols[j].w;
        }
        if (i < this.cells.length && j < this.cells[i].length) {
            return this.cells[i][j].pick(x, y);
        } else {
            return null;
        }
    }
});

disconsolate.Button = disconsolate.Widget.subclass({
    constructor: function(child, callback, data) {
        this.child = child;
        this.callback = callback;
        this.data = data;
    },
    layout: function() {
        this.child.layout();
        this.w = this.child.w;
        this.h = this.child.h;
    },
    draw: function(screen, x, y) {
        this.child.draw(screen, x, y);
    },
    click: function() {
        this.callback(this.data);
    }
});

}();

