
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
}

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

}();

