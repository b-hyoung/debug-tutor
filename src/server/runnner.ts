import { rejects } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type Lang = "c" | "python"

function run(cmd: string[], timeoutMs = 2000){
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFile(cmd[0], cmd.slice(1), { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) return reject({ err, stdout, stderr });
            resolve({stdout , stderr})
        })
    })
}

export async function runInDocker(params : {language : Lang; code :string , input:string}){
    const {language , code , input } = params

    // 요청별 임시 작업
    const dir = await mkdtemp(join(tmpdir(), "dt-"));
    const codeFile = join(dir, language === "c" ? "main.c" : "main.py");
    const inFile = join(dir, "input.txt");
    await writeFile(codeFile, code, "utf8");
    await writeFile(inFile, input, "utf8");

    //공용 도커 실행 옵션
    const base =[
        "run" , "--rm",
        "--network=none",
        "--cpus=1","--memory=256m" , "--pids-limit=128",
        "--read-only",
        "-v",`${dir}:/work:rw`, // 코드 입력만 공유
        "-w", "/work",
        "--security-opt","no-new-privileges",
        "--cap-drop","ALL",
        "debug-runner",
    ]

    try{
        if (language === "c"){
            //컴파일 => 실행
            await run ([ "docker" , ...base , "bash" , "-ic" , "gcc -O2 -std=c11 main.c -o main 2> compile.err || { cat compile.err 1>&2; exit 42; }",
            ],4000)
            const { stdout } = await run ([ "docker" , ...base , "bash" , "-ic" , "./main < input.txt" ],2000)
            return { ok: true as const , stdout }
        }else{
            //파이썬
            const { stdout } = await run(["docker", ...base, "bash", "-lc", "python3 main.py < input.txt"], 2000);
            return { ok: true as const, stdout };
        }
    }catch(e:any){
        const msg = e?.stderr || e?.stdout || String(e?.err || e);
        return { ok: false as const, error: msg.slice(0, 4000) };
    }
}