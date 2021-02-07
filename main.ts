type Bit = 0 | 1;
type Word = [
    Bit, // 1
    Bit, // 2
    Bit, // 3
    Bit, // 4
    Bit, // 5
    Bit, // 6
    Bit, // 7
    Bit, // 8
    Bit, // 9
    Bit, // 10
    Bit, // 11
    Bit, // 12
    Bit, // 13
    Bit, // 14
    Bit, // 15
    Bit // 16
];

// @ts-ignore
const True = (): Word => new Array(16).fill(null).map(() => 1);
// @ts-ignore
const False = (): Word => new Array(16).fill(null).map(() => 0);

class ROM {
    address: Word = False();
    out: Word = False();

    private registers: { [key: string]: Word } = {};

    set(key: Word, value: Word) {
        this.registers[key.join('')] = value;
    }

    process() {
        const key = this.address.join('');
        this.out = this.registers[key];
    }
}

class RAM {
    in: Word = False();
    address: Word = False();
    write: Bit = 0;
    out: Word = False();

    private registers: { [key: string]: Word } = {};

    process() {
        const key = this.address.join('');
        if (this.write) {
            this.registers[key] = this.in;
        }

        if (this.registers[key] == null) {
            this.registers[key] = False();
        }

        return this.registers[key];
    }

    read(addr: Word) {
        return this.registers[addr.join('')];
    }
}

class Not {
    in: Word = False();
    out: Word = False();

    process() {
        // @ts-ignore
        this.out = this.in.map((bit) => (bit === 0 ? 1 : 0));
    }
}

class And {
    in1: Word = False();
    in2: Word = False();
    out: Word = False();

    process() {
        this.out = False();
        this.in1.forEach((bit1, index) => {
            const bit2 = this.in2[index];
            this.out[index] = bit1 === 1 && bit2 === 1 ? 1 : 0;
        });
    }
}

class Sum {
    in1: Word = False();
    in2: Word = False();
    out: Word = False();

    process() {
        this.out = False();
        let carry: Bit = 0;
        this.in1
            .slice()
            .reverse()
            .forEach((bit1, index) => {
                const reversedIndex = 15 - index;
                const bit2 = this.in2[reversedIndex];
                if (bit1 === 0 && bit2 === 0) {
                    this.out[reversedIndex] = carry;
                    carry = 0;
                    return;
                }
                if ((bit1 === 0 && bit2 === 1) || (bit1 === 1 && bit2 === 0)) {
                    if (carry === 1) {
                        this.out[reversedIndex] = 0;
                    } else {
                        this.out[reversedIndex] = 1;
                    }
                    return;
                }
                if (bit1 === 1 && bit2 === 1) {
                    if (carry === 1) {
                        this.out[reversedIndex] = 1;
                    } else {
                        this.out[reversedIndex] = 0;
                        carry = 1;
                    }
                    return;
                }
            });
    }
}

class ALU {
    // in
    x: Word = False();
    y: Word = False();
    zx: Bit = 0;
    nx: Bit = 0;
    zy: Bit = 0;
    ny: Bit = 0;
    f: Bit = 0;
    no: Bit = 0;

    // out
    out: Word = False();
    zr: Bit = 0;
    ng: Bit = 0;

    // internal
    private not = new Not();
    private and = new And();
    private sum = new Sum();

    process() {
        let x = this.x.slice() as Word;
        let y = this.y.slice() as Word;
        if (this.zx === 1) {
            x = False();
        }
        if (this.nx === 1) {
            this.not.in = x;
            this.not.process();
            x = this.not.out;
        }
        if (this.zy === 1) {
            y = False();
        }
        if (this.ny === 1) {
            this.not.in = y;
            this.not.process();
            y = this.not.out;
        }
        if (this.f === 1) {
            this.sum.in1 = x;
            this.sum.in2 = y;
            this.sum.process();
            this.out = this.sum.out;
        } else {
            this.and.in1 = x;
            this.and.in2 = y;
            this.and.process();
            this.out = this.and.out;
        }
        if (this.no === 1) {
            this.not.in = this.out;
            this.not.process();
            this.out = this.not.out;
        }
        const outEqual0 = this.out.reduce((acc, bit) => {
            if (acc !== 0) {
                return acc;
            }
            return bit;
        });
        if (outEqual0 === 0) {
            this.zr = 1;
        } else {
            this.zr = 0;
        }
        if (this.out[0] === 1) {
            this.ng = 1;
        } else {
            this.ng = 0;
        }
    }
}

// Instruction register

class ProgramCounter {
    in: Word = False();
    reset: Bit = 0;
    load: Bit = 0;

    out: Word = False();

    private summer = new Sum();

    process() {
        if (this.reset === 1) {
            this.out = False();
        }

        if (this.load === 1) {
            this.out = this.in;
            return;
        }

        this.summer.in1 = this.out;
        this.summer.in2 = decimalToBinary(1);
        this.summer.process();
        this.out = this.summer.out;
    }
}

class Multiplexer {
    in1: Word = False();
    in2: Word = False();
    control: Bit = 0;

    out: Word = False();

    process() {
        if (this.control === 0) {
            this.out = this.in1;
        }
        if (this.control === 1) {
            this.out = this.in2;
        }
    }
}

class Register {
    // in
    in: Word = False();
    write: Bit = 0;

    // out
    out: Word = False();

    // internal
    private next: Word = False();

    process() {
        this.out = this.next;
        if (this.write === 1) {
            this.next = this.in;
        }
    }
}

class CPU {
    // in
    inM: Word = False();
    instruction: Word = False();
    reset: Bit = 0;

    // out
    outM: Word = False();
    writeM: Bit = 0;
    addressM: Word = False();
    pc: Word = False();

    // control bits
    czx: Bit = 0; // for alu
    cnx: Bit = 0; // for alu
    czy: Bit = 0; // for alu
    cny: Bit = 0; // for alu
    cf: Bit = 0; // for alu
    cno: Bit = 0; // for alu

    //internal
    alu = new ALU();
    programCounter = new ProgramCounter();

    registerA = new Register();
    registerD = new Register();

    mux1 = new Multiplexer();
    mux2 = new Multiplexer();

    process() {
        this.mux1.in1 = this.instruction;
        this.mux1.in2 = this.alu.out;
        // A or C instruction
        this.mux1.control = this.instruction[0];
        this.mux1.process();

        this.registerA.in = this.mux1.out;
        this.registerA.write =
            this.instruction[10] || (this.instruction[0] === 0 ? 1 : 0);
        this.registerA.process();

        this.mux2.in1 = this.registerA.out;
        this.mux2.in2 = this.inM;
        this.mux2.control = this.instruction[3];
        this.mux2.process();

        this.registerD.in = this.alu.out;
        this.registerD.write =
            this.instruction[11] || (this.instruction[0] === 0 ? 1 : 0);
        this.registerD.process();

        this.alu.x = this.registerD.out;
        this.alu.y = this.mux2.out;
        this.alu.zx = this.instruction[4];
        this.alu.nx = this.instruction[5];
        this.alu.zy = this.instruction[6];
        this.alu.ny = this.instruction[7];
        this.alu.f = this.instruction[8];
        this.alu.no = this.instruction[9];

        this.alu.process();

        this.outM = this.alu.out;
        this.writeM = this.instruction[12];
        this.addressM = this.registerA.out;

        this.programCounter.in = this.registerA.out;
        this.programCounter.reset = this.reset;
        // this.instruction[13]; // j1
        // this.instruction[14]; // j2
        // this.instruction[15]; // j3
        this.programCounter.load = 0;
        if (
            this.instruction[0] === 1 &&
            this.instruction[13] === 1 &&
            this.alu.ng === 1
        ) {
            // < 0
            this.programCounter.load = 1;
        }
        if (
            this.instruction[0] === 1 &&
            this.instruction[14] === 1 &&
            this.alu.zr === 1
        ) {
            // === 0
            this.programCounter.load = 1;
        }
        if (
            this.instruction[0] === 1 &&
            this.instruction[15] === 1 &&
            this.alu.ng === 0
        ) {
            // > 0
            this.programCounter.load = 1;
        }
        this.programCounter.process();

        this.pc = this.programCounter.out;
    }
}

// Data bus
// Address bus
// Control bus

function loadProgramToRom(program: Word[], rom: ROM) {
    const summer = new Sum();
    let acc = False();

    program.forEach((instruction) => {
        rom.set(acc, instruction);

        summer.in1 = acc;
        summer.in2 = decimalToBinary(1);
        summer.process();
        acc = summer.out;
    });
}

const C_INSTRUCTIONS = {
    '0': '0101010',
    '1': '0111111',
    '-1': '0111010',
    D: '0001100',
    A: '0110000',
    M: '1110000',
    '!D': '0001101',
    '!A': '0110001',
    '!M': '1110001',
    '-D': '0001101',
    '-A': '0110011',
    '-M': '1110011',
    'D+1': '0011111',
    'A+1': '0110111',
    'M+1': '1110111',
    'D-1': '0001110',
    'A-1': '0110010',
    'M-1': '1110010',
    'D+A': '0000010',
    'D+M': '1000010',
    'D-A': '0010011',
    'D-M': '1010011',
    'A-D': '0000111',
    'M-D': '1000111',
    'D&A': '0000000',
    'D&M': '1000000',
    'D|A': '0010101',
    'D|M': '1010101',
};

function cInstruction(
    comp: keyof typeof C_INSTRUCTIONS,
    data: string,
    jump: string
): Word {
    // @ts-ignore
    return `111${C_INSTRUCTIONS[comp]}${data}${jump}`
        .split('')
        .map((c) => (c === '1' ? 1 : 0));
}

// Von-neumann (or actually Harvard?) architecture
function main() {
    const rom = new ROM();
    const ram = new RAM();
    const cpu = new CPU();

    // - A instruction is basically just a number to set for A register
    //     the first bit is always 0 because
    //     there are only positive addresses in ROM
    //
    // - C instruction is set of control bits
    loadProgramToRom(
        [
            decimalToBinary(1),
            cInstruction('A+1', '010', '000'),
            decimalToBinary(2),
            cInstruction('D+A', '001', '000'),
        ],
        rom
    );

    ram.address = decimalToBinary(1);
    ram.in = decimalToBinary(17);
    ram.write = 1;
    ram.process();

    ram.address = decimalToBinary(0);
    ram.write = 0;

    while (true) {
        rom.address = cpu.pc;

        rom.process();

        if (rom.out == null) {
            break;
        }

        cpu.instruction = rom.out;
        cpu.inM = ram.out;

        cpu.process();

        ram.in = cpu.outM;
        ram.address = cpu.addressM;
        ram.write = cpu.writeM;

        ram.process();
    }

    console.log(binaryToDecimal(ram.read(decimalToBinary(2))));
}
main();

function binaryToDecimal(bin: Word): number {
    const num = bin
        .slice()
        .reverse()
        .reduce<number>((acc, bit, index) => {
            if (bit === 0) {
                return acc;
            }
            return acc + Math.pow(2, index);
        }, 0);

    if (bin[0] === 0) {
        return num;
    }

    return num - Math.pow(2, 16);
}

function decimalToBinary(num: number): Word {
    function positiveDecimalToBinary(numPositive: number) {
        const stack: Bit[] = [];
        let decNumber = numPositive;

        while (decNumber > 0) {
            const reminder = decNumber % 2;
            stack.push(reminder as Bit);
            decNumber = Math.floor(decNumber / 2);
        }

        const result = False();
        stack.forEach((bit: Bit, index) => {
            result[result.length - index - 1] = bit;
        });

        return result;
    }

    if (num > 0) {
        return positiveDecimalToBinary(num);
    }

    return positiveDecimalToBinary(num + Math.pow(2, 16));
}
